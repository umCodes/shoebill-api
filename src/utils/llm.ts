import { GoogleGenAI } from "@google/genai";
import { ClearUpPrompt, QuizPrompt } from '../models/quiz.types';
import { geminiApiKey } from "../constants/env";
import { HttpError } from "../errors/http-error";
import { quizPrompt } from "./prompts";



export const ai = new GoogleGenAI({ apiKey: geminiApiKey });


//QUIZZES
export async function generateQuizFromLlm(content: QuizPrompt){
    try{
        const request = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: quizPrompt(content),
        });
        const response = String(request.text).replaceAll('`', '').replace('json', '')
        
        console.log(response);
        
        if("status" in JSON.parse(response)) throw new HttpError("Invalid file content", 400)
        
        return JSON.parse(response)
    }catch(error){
        console.log('🔴 Error generating quiz at ./utils/llm.ts -> generateQuizFromLlm(): ');
        throw error
    }
    
}

// function quizPrompt({ subject, qTypes, difficulty, number, prev }: QuizPrompt): string {
//     return `
//         Generate a quiz in JSON using the format below. No extra text, just a JSON object (type Questions).
//             Rules:
//                 Stick to topic if subject is long;
//                 Strict rule: The number of questions returned must always be exactly equal to the ${number}, no less.

//                 If the input is not an academic topic, an essay, book, lecture note, or any written text discussing a topic (for example: an exam paper, non-educational content, very vague and unclear topic and discussion , a casual query, command, or general conversation), return:
//                     { "status": "error", "message": "Invalid entry." } and ignore the below part of the prompt

//                 If difficulty is unreasonable for subject, return:
//                     { "status": "error", "message": "Difficulty level doesn't match subject." } and ignore the below part of the prompt

//                 Else if subject is an abbreviation, vague, conversational, general, or non-educational:
//                     { "status": "error", "message": "Subject too abstract or general, please enter a more specified value." } and ignore the below part of the prompt

//                 Difficulty levels:
//                     Basic: recall/definitions
//                     Regular: foundational, non-trivial
//                     Intermediate: reasoning/application
//                     Advanced: deep/multi-step
//                     Expert: tricky/problem-solving            

//                 Output Types:
//                 type MCQ = {
//                     type: "MCQ";
//                     question: string;
//                     options: { answer: string; correct: boolean }[];
//                     explanation: string;
//                 };

//                 type TF = {
//                     type: "TF";
//                     question: string;
//                     options: [{ answer: boolean; correct: boolean }, { answer: boolean; correct: boolean }];
//                     explanation: string;
//                 };

//                 export type SAQ = {
//                     type: "SAQ";   
//                     question: string;
//                     answers: string;
//                     explanation: string;
//                 };

//                 export type FIB = {
//                     type: "FIB";
//                     question: string;
//                     answers: string;
//                     explanation: string;
//                 };

//                 type Questions = { 
//                     topic: string;
//                     questions: (MCQ | TF | SAQ | FIB)[];
//                 }

//                 type QuizError = {
//                     status: "error";
//                     message: string;
//                 }
    
//             exclude any of the following questions: ${prev}

//             Input:
//                 subject: "${subject}"
//                 difficulty: "${difficulty}"
//                 number of questions: ${number} // Strictly generate exactly this many questions, no less.
//                 question types: ${qTypes.join(', ')}
//     `;
// }



// //CLEAR UPS 

// export function clearUpPrompt({ subject, qTypes, prev }: ClearUpPrompt): string {
//     return `
//         You are processing extracted exam paper, quiz, or query text.

//         INPUT TEXT:
//         ${subject}

//         PREVIOUSLY EXTRACTED QUESTIONS:
//         ${prev}

//         RULE: 
//         - If the input is not an exam paper, quiz, or academic query, return:
//             { "status": "error", "message": "Invalid input: input must be an exam paper, quiz, or academic query." }
//           and do not process further.

//         TASK:
//         - Clean and parse the input.
//         - Extract **only** the following question types: ${qTypes.join(', ')}.
//         - Allowed types: MCQ, TF, FIB, SAQ. Ignore everything else.

//         RULES:
//         1. Remove numbering, page refs, whitespace, unrelated text.
//         2. Keep only complete questions; if incomplete, repair into concise, well-formed wording.
//         3. Format strictly as JSON with these schemas:

//         **MCQ**
//         { "type": "MCQ", "question": string, "options": [ { "answer": string, "correct": boolean }, ... ] }

//         **SAQ**
//         { "type": "SAQ", "question": string, "answer": string }

//         **FIB**
//         { "type": "FIB", "question": string, "answer": [string, ...] }

//         **TF**
//         { "type": "TF", "question": string, "options": [ { "answer": true, "correct": boolean }, { "answer": false, "correct": boolean } ] }

//         4. Convert “True”/“False” into booleans.
//         5. Deduplication:
//         - Exclude any question (exact/partial, case/punctuation variations) already in ${prev}.
//         - Remove duplicates within this batch.
//         - If uncertain, exclude.
//         6. Output strictly:

//         { "questions": [ ... ] }

//         NO extra text, no comments, no code fences. Output must be valid JSON.
//     `;
// }




