import { ClearUpPrompt, QuizPrompt } from "../models/quiz.types";


export function quizPrompt({ subject, qTypes, difficulty, number, prev }: QuizPrompt): string {
    return`
    Generate a quiz in JSON format. Output only a JSON object of type Questions. No extra text.

    Rules:
    1. Stick strictly to the subject, even if it is long.
    2. The number of questions must exactly equal ${number}. No fewer, no more, unless: 
        - If duplicates are unavoidable, omit repeated questions.
        - It is acceptable to generate fewer than ${number} questions rather than duplicating any question.


    Validation:
    - If the input is not an academic topic, essay, book, lecture note, or any educational text (e.g., exam paper, non-educational content, vague/unrelated topic, casual query, command, or general conversation):
    { "status": "error", "message": "Invalid entry." }
    - If the difficulty is unreasonable for the subject:
    { "status": "error", "message": "Difficulty level doesn't match subject." }
    - If the subject is an abbreviation, vague, conversational, general, or non-educational:
    { "status": "error", "message": "Subject too abstract or general, please enter a more specified value." }

    Difficulty Levels:
    - Basic: recall/definitions (simple facts, terms, concepts, common knowledge)
    - Regular: foundational, non-trivial (understanding principles, straightforward reasoning)
    - Intermediate: reasoning/application (apply knowledge to solve problems, analyze, explain concepts)
    - Advanced: deep/multi-step (complex problem-solving, critical thinking, multi-step reasoning within material scope)
    - Expert: tricky/problem-solving (challenging questions requiring creative thinking, synthesis, potentially beyond immediate scope)

    Output Types:
    type MCQ = {
        type: "MCQ";
        question: string;
        options: { answer: string; correct: boolean }[];
        explanation: string;
    };

    type TF = {
        type: "TF";
        question: string;
        options: [{ answer: boolean; correct: boolean }, { answer: boolean; correct: boolean }];
        explanation: string;
    };

    type SAQ = {
        type: "SAQ";
        question: string;
        answers: string;
        explanation: string;
    };

    type FIB = {
        type: "FIB";
        question: string;
        answers: string;
        explanation: string;
    };

    type Questions = {
        topic: string;
        questions: (MCQ | TF | SAQ | FIB)[];
    };

    type QuizError = {
        status: "error";
        message: string;
    };

    Exclusions:
    - Do not replicate or rewrite any question from the following list.
    - Each generated question must be unique and not a variation of any question in the list below:
    ${prev}

    Input:
    - subject: "${subject}"
    - difficulty: "${difficulty}"
    - number of questions: ${number} // Must generate exactly this many questions.
    - question types: ${qTypes.join(', ')}
        `;
}






//CLEAR UPS 

export function clearUpPrompt({ subject, qTypes, prev }: ClearUpPrompt): string {
    return `
        You are processing extracted exam paper, quiz, or query text.

        INPUT TEXT:
        ${subject}

        PREVIOUSLY EXTRACTED QUESTIONS:
        ${prev}

        RULE: 
        - If the input is not an exam paper, quiz, or academic query, return:
            { "status": "error", "message": "Invalid input: input must be an exam paper, quiz, or academic query." }
          and do not process further.

        TASK:
        - Clean and parse the input.
        - Extract **only** the following question types: ${qTypes.join(', ')}.
        - Allowed types: MCQ, TF, FIB, SAQ. Ignore everything else.

        RULES:
        1. Remove numbering, page refs, whitespace, unrelated text.
        2. Keep only complete questions; if incomplete, repair into concise, well-formed wording.
        3. Format strictly as JSON with these schemas:

        **MCQ**
        { "type": "MCQ", "question": string, "options": [ { "answer": string, "correct": boolean }, ... ] }

        **SAQ**
        { "type": "SAQ", "question": string, "answer": string }

        **FIB**
        { "type": "FIB", "question": string, "answer": [string, ...] }

        **TF**
        { "type": "TF", "question": string, "options": [ { "answer": true, "correct": boolean }, { "answer": false, "correct": boolean } ] }

        4. Convert “True”/“False” into booleans.
        5. Deduplication:
        - Exclude any question (exact/partial, case/punctuation variations) already in ${prev}.
        - Remove duplicates within this batch.
        - If uncertain, exclude.
        6. Output strictly:

        { "questions": [ ... ] }

        NO extra text, no comments, no code fences. Output must be valid JSON.
    `;
}
