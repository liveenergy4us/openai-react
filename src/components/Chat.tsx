// src/components/Chat.tsx
import React, { useEffect, useState } from "react";
import { TextField, Button, Container, Grid, LinearProgress, CircularProgress } from "@mui/material";
import Message from "./Message";
import OpenAI from "openai";
import { MessageDto } from "../models/MessageDto";
import SendIcon from "@mui/icons-material/Send";

const Chat: React.FC = () => {
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<MessageDto>>(new Array<MessageDto>());
  const [input, setInput] = useState<string>("");
  const [assistant, setAssistant] = useState<any>(null);
  const [thread, setThread] = useState<any>(null);
  const [openai, setOpenai] = useState<any>(null);

  useEffect(() => {
    initChatBot();
  }, []);

  useEffect(() => {
    setMessages([
      {
        content: "Hey! Cool, dass du da bist. Ich bin der Geschenke-Scout und ich bin hier, um dir zu helfen, das perfekte Geschenk zu finden. Wir werden gemeinsam eine super Idee entwickeln! Übrigens, du musst keine persönlichen Infos teilen, aber je mehr ich weiß, desto besser die Qualität meiner Geschenkvorschläge. Sag mir einfach ein bisschen über die Person, für die du ein Geschenk suchst. Was sind zum Beispiel ihre Hobbys? ",
        isUser: false,
      },
    ]);
  }, [assistant]);

  const initChatBot = async () => {
    const openai = new OpenAI({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    // Create an assistant
    const assistant = await openai.beta.assistants.create({
      name: "Geschenke Scout",
      instructions: "Du fungierst als Coach des Users um ein passendes Geschenk zu finden. GANZ WICHTIG, SCHLAGE ABER SELBST KEINE IDEEN VOR! Der User wird in seiner Nachricht über die Person und Hobbys des Beschenkten sprechen. Nutze das um ein Thema zu finden. Danach spezialisierst du dich auf dieses Thema und wirst immer konkreter und konkreter bis du dann auf ein passendes Produkt kommst. Sage dem User aber nicht, dass du jetzt zur Spezifizierung kommst. Dies ist nur ein Beispiel wie du Vorgehen solltest: Der User braucht ein Geschenk für seine Mama, welche sehr gerne kocht. Dann gehst du als Scout genauer auf das Themenfeld Kochen ein. Dann fragst du ob seine Mutter eher Kochgeräte braucht oder ein Kochkit mit Lebensmitteln oder zb ein Kochbuch (nur Beispiele). Der User möchte ein Kochbuch. Dann fragst du den User was seine Mutter am liebsten kocht oder backt, ob sie vegan oder vegetarisch ist usw. Bis du irgendwann zu einem Produkt kommst. Zum Schluss sagst du etwas wie: „Danke für deinen Input, dann weiß ich Bescheid wonach ich suchen muss.“ Sag dem User in der gleichen Nachricht, dass wenn die Suche für den User gestartet werden soll, er “Jetzt suchen” in den Chat schreiben soll. Wenn der User „Jetzt suchen“ schreibt, dann trigger bitte die function: make_paapi_call. Du wirkst selbstsicher und bist Experte. Sprich die User nicht mir “sie”, sondern mit “du” an. Du bist freundlich und professionell, aber direkt. Bitte achte darauf, dass du möglichst kurze und wenige Sätze von dir gibst. Alle weiteren Fragen, die über das Thema der Geschenkesuche hinweg gehen, darfst du unter keinen Umständen beantworten.",
      model: "gpt-4-1106-preview",
      tools: [{ 
        type: "function",
        function: {
          "name" : "make_paapi_call",
          "parameters" : {
            "type" : "object",
            "properties" : {
              "keywords" : {"type" : "string", "description" : "Three to five keywords for searching the selected gift on Amazon"}
            },
            "required": ["keywords"]
          },
          "description" : "Take in short keywords to find the selected gift on Amazon"
        }
      }],
    });

    // Create a thread
    const thread = await openai.beta.threads.create();

    setOpenai(openai);
    setAssistant(assistant);
    setThread(thread);
  };

  const createNewMessage = (content: string, isUser: boolean) => {
    const newMessage = new MessageDto(isUser, content);
    return newMessage;
  };

  const handleSendMessage = async () => {
    messages.push(createNewMessage(input, true));
    setMessages([...messages]);
    setInput("");

    // Send a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: input,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    // Create a response
    let response = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    // Wait for the response to be ready
    while (response.status === "in_progress" || response.status === "queued") {
      console.log("waiting...");
      setIsWaiting(true);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      response = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    setIsWaiting(false);

    // Get the messages for the thread
    const messageList = await openai.beta.threads.messages.list(thread.id);

    // Find the last message for the current run
    const lastMessage = messageList.data
      .filter((message: any) => message.run_id === run.id && message.role === "assistant")
      .pop();

    // Print the last message coming from the assistant
    if (lastMessage) {
      console.log(lastMessage.content[0]["text"].value);
      setMessages([...messages, createNewMessage(lastMessage.content[0]["text"].value, false)]);
    }
  };

  // detect enter key and send message
  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <Container>
      <Grid container direction="column" spacing={2} paddingBottom={2}>
        {messages.map((message, index) => (
          <Grid item alignSelf={message.isUser ? "flex-end" : "flex-start"} key={index}>
            <Message key={index} message={message} />
          </Grid>
        ))}
      </Grid>
      <Grid container direction="row" paddingBottom={5} justifyContent={"space-between"}>
        <Grid item sm={11} xs={9}>
          <TextField
            label="Type your message"
            variant="outlined"
            disabled={isWaiting}
            fullWidth
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          {isWaiting && <LinearProgress color="inherit" />}
        </Grid>
        <Grid item sm={1} xs={3}>
          <Button variant="contained" size="large" color="primary" onClick={handleSendMessage} disabled={isWaiting}>
            {isWaiting && <CircularProgress color="inherit" />}
            {!isWaiting && <SendIcon fontSize="large" />}
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Chat;
