import boxen from "boxen";
import chalk from "chalk";
import OpenAI from "openai";
import readline from "readline";

const useStream = !process.argv.includes("--no-stream");

const AI_CONFIG = {
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY,
  model: process.env.MODEL,
};

const openai = new OpenAI({
  baseURL: AI_CONFIG.baseURL,
  apiKey: AI_CONFIG.apiKey,
});

// Configuración de la interfaz de línea de comandos
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
// Banner de bienvenida con boxen y chalk
const welcomeMessage = boxen(
  chalk.bold.blue("Traduce con inteligencia artificial") +
    "\n" +
    'Puedes desactivar el streaming agrega "--no-stream" al comando' +
    "\n" +
    'Para salir envía "exit"' +
    "\n" +
    chalk.yellow("Español - Inglés"),

  {
    title: "TraductorAI",

    padding: 1,
    margin: 1,
    textAlignment: "center",
    backgroundColor: "#000000",
  }
);
const nonCredentialsExistMessage = boxen(
  chalk.red("Error: No se encontraron credenciales") +
    "\n" +
    chalk.whiteBright(
      "Asegúrate de haber configurado las variables de entorno BASE_URL, API_KEY y MODEL en un archivo .env"
    ),
  {
    padding: 1,
    margin: 1,
    textAlignment: "center",
    backgroundColor: "#000000",
  }
);

const SYSTEM_MESSAGES = Object.freeze([
  {
    role: "system",
    content: `
      Eres un traductor profesional bilingüe español-inglés con profundo conocimiento de expresiones coloquiales y dobles sentidos.

      Instrucciones clave:
      1. **Análisis contextual**: Detecta si la frase usa modismos, estructuras reflexivas (ej: "te pasó") o formas impersonales
      2. **Traducción idiomática**: Prioriza el significado sobre la traducción literal
      3. **Interpretación hispana**: 
         - "¿Te pasó algo?" → "Did something happen (to you)?" 
         - "¿Tienes onda?" → "Are you cool?"
         - "Me late" → "I'm into it"
      4. **Gramática avanzada**:
         - Distingue entre "pasó" (tercera persona) vs "paso" (primera persona)
         - Reconoce el "se" impersonal: "¿Cómo se dice?" → "How do you say?"
      5. **Respuesta**: Solo la traducción sin explicaciones

      Estilo: Natural, coloquial y preciso
      No agregues información innecesaria, solo traduce y no expliques tus respuestas ni des contexto adicional.
      Solo una traducción, no des múltiples opciones.
    `.replace(/\s+/g, " "), // Formateo de texto multi-línea
  },
]);
const ask = (question) => {
  return new Promise((resolve) => {
    rl.question(chalk.blue("➤ " + question + ": "), resolve);
  });
};
const showUsage = (usage) => {
  if (!usage) return;
  // Mostrar uso
  console.log(
    chalk.yellow(
      `Uso tokens: input = ${usage.prompt_tokens}, output = ${
        usage.completion_tokens
      }, total = ${usage.total_tokens}, cached = ${
        usage.prompt_tokens_details?.cached_tokens ?? 0
      }, uncached = ${
        usage.prompt_tokens - (usage.prompt_tokens_details?.cached_tokens ?? 0)
      }`
    )
  );
};
const translateStream = async (text) => {
  const messages = [...SYSTEM_MESSAGES, { role: "user", content: text }];

  const stream = await openai.chat.completions.create({
    messages: messages,
    model: AI_CONFIG.model,
    temperature: 1.3,
    stream: true, // Habilitar streaming
    stream_options: { include_usage: true },
  });

  let fullResponse = "";
  let usage = null;

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";

    // Mostrar el contenido incrementalmente
    process.stdout.write(chalk.whiteBright(content));
    fullResponse += content;

    // Capturar el uso final si está disponible
    if (chunk.usage) usage = chunk.usage;
  }

  // Al finalizar el stream
  process.stdout.write("\n");
  return { message: fullResponse, usage };
};

const translate = async (text) => {
  const messages = [...SYSTEM_MESSAGES, { role: "user", content: text }];

  const completion = await openai.chat.completions.create({
    messages: messages,
    model: AI_CONFIG.model,
    temperature: 1.3,
  });
  return {
    message: completion.choices[0].message.content,
    usage: completion.usage,
  };
};

const main = async () => {
  if (!AI_CONFIG.baseURL || !AI_CONFIG.apiKey || !AI_CONFIG.model) {
    console.error(nonCredentialsExistMessage);
    rl.close();
    return;
  }

  console.log(welcomeMessage);
  console.log(
    chalk.gray(
      `Modo: ${useStream ? "Streaming activado" : "Respuesta completa"}\n`
    )
  );
  console.log(chalk.gray(`Modelo: ${AI_CONFIG.model}\n`));

  try {
    while (true) {
      const userInput = await ask(chalk.italic("Escribe"));
      if (userInput.toLowerCase().trim() === "exit") break;

      console.log(chalk.green("\nTraduciendo..."));

      // Elegir el método basado en el argumento
      const { message, usage } = useStream
        ? await translateStream(userInput)
        : await translate(userInput);

      if (!useStream) console.log(chalk.whiteBright(message));
      showUsage(usage);
    }

    console.log(chalk.yellow("\nHasta luego!"));
    rl.close();
  } catch (error) {
    console.error(chalk.red("\nError en la traducción:"), error);
    rl.close();
  }
};

await main();
