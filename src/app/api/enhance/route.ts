import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    // Parse the request body
    const json = await req.json();
    const { prompt } = json;
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'No prompt provided' }), 
        { status: 400 }
      );
    }

    console.log('Enhancing prompt:', prompt);

    // Create chat completion with streaming
    const response = await openai.chat.completions.create({
      model: 'gpt-4',  // Using gpt-4 as gpt-4o might not be available
      messages: [
        {
          role: 'system',
          content: `You are an expert at converting verbal instructions into detailed, clear coding task instructions. 
          Your job is to take a raw transcript of spoken instructions and convert it into a well-structured, detailed prompt 
          that clearly explains the coding task to be performed. Add any necessary technical details. But please keep it very concise.
          
          Focus on:
          1. Clarifying ambiguous requirements
          2. Cleaning up the prompt
          3. Sticking to the original intent of the user's request and not adding any additional requirements or constraints.
          4. Dont add line breaks or newlines to the prompt.

          
          Format the output as a clear, professional prompt that can be directly used as instructions for implementing the code.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: true,
    });

    // Convert the response into a friendly stream
    const stream = OpenAIStream(response);

    // Return a StreamingTextResponse, which can be consumed by the client
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Error in enhance API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to enhance transcript',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: 500 }
    );
  }
} 
