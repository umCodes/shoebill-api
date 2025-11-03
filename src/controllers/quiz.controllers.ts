import { NextFunction, Request, Response } from "express";
import { maxNumOfQuestions, minNumOfQuestions } from "../constants/constriants.constants";
import { HttpError } from "../errors/http-error";
import { difficultyLevels, FIB, MCQ, Questions, QuestionTypes, questionTypes, Quiz, SAQ, TF } from "../models/quiz.types";
import { generateQuizFromLlm } from "../utils/llm";
import { AuthRequest } from "../middlewares/auth-handler.middlewares";
import { getCollection } from "../db/db";
import { CreditsRequest } from "../middlewares/file-processor.middlewares";
import { creditsPerQuestion } from "../constants/credits.constants";
import { subtractUserCredits } from "../utils/credits";
import { ObjectId } from "mongodb";
import { User } from "../models/user.types";
import { llmApiKey, llmModels } from "../constants/env";
// import { rm, mkdir } from "fs/promises";
// import path from "path";

// const folderPath = path.resolve("./uploads");

// // Function to clear folder
// async function clearUploads() {
//   try {
//     await rm(folderPath, { recursive: true, force: true });
//     await mkdir(folderPath, { recursive: true }); // recreate empty folder
//     console.log(`[${new Date().toISOString()}] Uploads folder cleared`);
//   } catch (err) {
//     console.error("Error clearing uploads:", err);
//   }
// }

// // Clear every 5 minutes (300,000 ms)
// setInterval(clearUploads, 7 * 60 * 1000);

// // Optionally run once on startup
// clearUploads();



export async function getTotalQuizzes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const uid = String(req.user?.uid);

        // Validate user
        if (!uid) throw new HttpError('Unauthorized', 401);

        // Get collection
        const quizesCollection = await getCollection<Quiz>('quizHistories');
        if (!quizesCollection) throw new HttpError('Collection not found', 404);

        // Get total number of quizzes
        const totalQuizzes = await quizesCollection.countDocuments({ uid });

        res.json({ totalQuizzes });
    } catch (error) {
        console.log('🔴 Error fetching total quizzes at ./controllers/quiz.controllers.ts -> getTotalQuizzes(): ');
        next(error);
    }

}

export async function getQuizzes(req: AuthRequest, res: Response, next: NextFunction) {
    
    //Pagination 
    const page = Number(req.query.page || 0) ;
    const limit = 10;
    const skip = page * limit;
    
    const uid = String(req.user?.uid);
    console.log();
    
    try {

        //Validate User
        if(!uid) throw new HttpError('Unauthorized', 401);

        //Get Quizzes Collection...
        const quizesCollection = await getCollection<Quiz>('quizHistories');
        if(!quizesCollection) throw new HttpError('Collection not found', 404);
        
        const length = await quizesCollection.countDocuments({uid}); //Number of User's Quizzes 
        const quizes = (await quizesCollection.find({uid}).sort({ _id: -1 })
                        // .skip(skip).limit(limit)
                        .toArray());  //Retrieve Paginated User's Quizzes   
        
        // 🟢 debbuging log
        // console.log(quizes, length, quizes.length);
        res.json({quizes, length})
        return;    

    } catch (error) {
        console.log('🔴 Error fetching quizzes at ./controllers/quiz.controllers.ts -> getQuizzes(): ');
        next(error);
    }

}

export async function getQuiz(req: AuthRequest, res: Response, next: NextFunction) {
   
    //Quiz ID
    const quizId = String(req.query.id);
    
    //User ID
    const uid = String(req.user?.uid); 
    
    try {

        //Validate User
        if(!uid) throw new HttpError('Unauthorized', 401);
    
        //Validate Quiz ID
        if(!quizId) throw new HttpError('Quiz ID not provided', 400);


        const quizesCollection = await getCollection<Quiz>('quizHistories');
        if(!quizesCollection) throw new HttpError('Collection not found', 500);
        
        //Find Quiz
        const quiz = await quizesCollection.findOne({uid, _id: new ObjectId(quizId)})

        res.json(quiz)        
        return;

    } catch (error) {
        console.log('🔴 Error fetching quiz at ./controllers/quiz.controllers.ts -> getQuiz(): ');
        next(error);
    }

}

export async function deleteQuiz(req: AuthRequest, res: Response, next: NextFunction){
    
    //Quiz ID
    const quizId = String(req.query.id);

    //User ID
    const uid = String(req.user?.uid)
    
    try {
        //Validate User
        if(!uid) throw new HttpError('Unauthorized', 401);
    
        //Validate Quiz ID
        if(!quizId) throw new HttpError('Quiz ID not provided', 400);


        //Get DB and Collection....
        const quizesCollection = await getCollection<Quiz>('quizHistories');
        if(!quizesCollection) throw new HttpError('Collection not found', 500);

        //Delete Quiz
        await quizesCollection.deleteOne({uid, _id: new ObjectId(quizId)})

        res.status(204).json({
            message: 'delete successful'
        })    
        return;
        
    } catch (error) {
        console.log('🔴 Error deleting quiz at ./controllers/quiz.controllers.ts -> deleteQuiz(): ');
        next(error)

    }
}

export async function createQuiz(req: AuthRequest & CreditsRequest, res: Response, next: NextFunction){
    
    const { body } = req;

    const { subject, difficulty, file_type } = body
    const qTypes = JSON.parse(body.qTypes);
    console.log('qTypes', qTypes);

    const number = Number(body.number) as Quiz['number'];
    try{    
        const uid = req.user?.uid;
        if(!uid) throw new HttpError('Unauthorized', 401);
        
    //Validate whether:
        //- Subject is valid
        if(!subject || subject.length === 0) throw new HttpError('Subject is required', 400);        
        //- Difficulty level is valid
        if(!difficulty || !difficultyLevels.some(d => d === difficulty)) throw new HttpError('Invalid difficulty level', 400)
        //- Question types is valid
        if(!qTypes || !qTypes.every((q: QuestionTypes) => questionTypes.includes(q))) throw new HttpError('Invalid question types', 400)
        //- Number of questions is valid
        if(!number || isNaN(number)) throw new HttpError('Number of questions is required', 400);
        if(number > maxNumOfQuestions || number < minNumOfQuestions) throw new HttpError("Invalid number of questions", 400);
        //- Credits are preCalculated
        if(!req.credits || typeof req.credits !== 'number') throw new HttpError('Something went wrong, please try again.', 500);
        //- User credits are sufficient to procceed task 
        //Get and validate userbase
        const usersBase = await getCollection<User>('users')
            if(!usersBase) throw new HttpError('Could not connect to database', 500)
            //Check whether user has enough credits for the task 
            const userCredits = (await usersBase.findOne({_id: new ObjectId(uid)}, {projection: {credits: 1}}))?.credits;
            const preCredits = req.credits + (creditsPerQuestion * number)
            if(!userCredits && userCredits !== 0) throw new HttpError('Could not fetch user credits', 500);
            if(userCredits < preCredits) throw new HttpError("Insufficient Credits.", 402)

        // [🔋🔋🔋🪫]
        // n = number of questions
        // split into (n / 20) groups of 20 questions
        // include an additional group if  a remainder exist
        let groups = Math.floor(number / 20); // numbers groups of 20 or less (remainders)
        const remaining = number % 20; // the last remaining groups that doesn't make 20 questions 🪫
        if(remaining) groups++; //if a rmaining group exist, increment groups by 1
        
        let allQuestions: (TF | MCQ | SAQ | FIB)[] = []; // all questions generated will be stored here 
        let topic = ''; // quiz topic
        while(groups > 0){
            const prev = JSON.stringify(allQuestions.map(q => (q.question))); // previously generated questions to prevent duplicates     
            
            let noOfQuestions = groups === 1 && remaining ? remaining : 20; 
            // ^ if the final group is reached and it is incomplete (🪫) 
            // -assign: remaining 
            // else assign: 20 

            const questions: Questions = await generateQuizFromLlm({subject, qTypes, difficulty, number: noOfQuestions, prev});
            // feed data to llm
            // subject: the text content of the file uplaoded
            // qTypes: question types (MCQ, TF, SAQ, FIB)
            // difficulty: difficulty level (basic to expert)
            // number: number of questions
            // prev: previously generated group of question within the loop 

            
            //Validate retuned questions
            if(!questions) throw new HttpError('A problem occured generating quiz', 500)
            
            allQuestions = [...allQuestions, ...questions.questions];
            
            groups--;

            
            // console.log(`group ${groups}: ` , questions);
            //if loop is finished set topic
            if(!groups) topic = questions.topic
        }

        //Calculate confirmed needed credits 
        const credits = Number((req.credits + (creditsPerQuestion * allQuestions.length)).toFixed(2))
        
        //Set up clear up
        const quiz: Quiz = {
            uid: String(uid), // user mongodb _id
            type: "Quiz", // the process/service (clearup or quiz) created from
            created_at: new Date().toISOString(), // creation date
            generated_from: `${file_type as "image" | "text" } pdf`,
            topic,
            difficulty,
            question_types: qTypes, // question types
            number: allQuestions.length, // number of generated questions 
            credits,  // credits used for this process
            questions: allQuestions // the actuall generated questions

        }

        //Store quiz in db 
        const quizHistories = await getCollection<Quiz>('quizHistories')
        if(!quizHistories) throw new HttpError('Could not connect to database', 500);
        const {acknowledged} = await quizHistories?.insertOne(quiz)
        if(!acknowledged) throw new HttpError('Could not store quiz data', 500);
        
        //Subtract credits
        if(!quiz.credits || !uid) throw new HttpError('Something went wrong, please try again.', 500);
        await subtractUserCredits(quiz.credits, String(uid))
        res.status(201).json(quiz);
        return;      
    }catch(error){
        console.log('🔴 Error creating quiz at ./controllers/quiz.controllers.ts -> createQuiz(): ');
        return next(error);
    }

}


export async function checkQuestionAnswer(req: AuthRequest & CreditsRequest, res: Response, next: NextFunction){
    //User ID
    const uid = String(req.user?.uid); 
    const {question, answer, explanation} = req.body;
    try {
        console.log(question, answer);
        
        //Validate User
        if(!uid) throw new HttpError('Unauthorized', 401);
                const request = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${llmApiKey}`,
                    'Content-Type': 'application/json',
                },
                
                body: JSON.stringify({
                    model: llmModels.deepseek_r1,
                    messages: [
                    {
                        role: 'user',
                        content: `
                        You are given two inputs:
                            question: {${question}}

                            answer: {${answer}}

                            Your task:

                            1. Check if the inputs are valid:

                            question must be a genuine question.

                            answer must be a genuine attempt to answer the question.
                            If either is invalid, output only:
                            { "valid": false, "reason": "Invalid input: not a question or not an answer." }

                            2. If valid, determine whether the answer correctly addresses the question compared to the following explanation:
                            explanation: {${explanation}}



                            If correct, output:
                                { "valid": true, "correct": true }
                            If incorrect, output:
                                { "valid": true, "correct": false }
                            
                            - Rules:
                                Output must be a single JSON object.

                                Do not include any text outside the JSON
                        `,
                    },
                    ],
                }),

                }
            );


            //Parse llm respone as json:
            const response = await request.json();
            console.log(response);

            const message = response.choices[0].message.content.replaceAll('`', '').replace('json', '');
            const parsed = await JSON.parse(message);
            console.log('generated from generateQuiz():  ', parsed);

            //Checks if returned json is valid
            if(!parsed) throw new Error(parsed);
            const {valid} = parsed;
            if(!valid) throw new HttpError(parsed.reason, 400)
                
            res.status(200).json(parsed)
        
    } catch (error) {
        console.log('🔴 Error checking answer at ./controllers/quiz.controllers.ts -> checkQuestionAnswer(): ');
        next(error);
    }

}
