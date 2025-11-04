import { NextFunction, Request, response, Response } from "express";
import { ClearUp, questionTypes, Quiz } from "../models/quiz.types";
import { HttpError } from "../errors/http-error";
import { AuthRequest } from "../middlewares/auth-handler.middlewares";
import { CreditsRequest } from "../middlewares/file-processor.middlewares";
import { getCollection } from "../db/db";
import { User } from "../models/user.types";
import { ObjectId } from "mongodb";
import { ai } from "../utils/llm";
import { subtractUserCredits } from "../utils/credits";
import { clearUpPrompt } from "../utils/prompts";




export async function clearUpPaper(req: AuthRequest & CreditsRequest, res: Response, next: NextFunction){
    const { file, body } = req;
    const {file_type, subject} = body;
    const qTypes = JSON.parse(body.qTypes) as Quiz['question_types'];
    

    try {
    //Check if file exists
    if(!file) throw new HttpError('File not provided.', 400);
    //Validate User
    const uid = req.user?.uid;
    if(!uid) throw new HttpError('Unauthorized', 401);

    //Validate whether:
        //- Subject is valid
        if(!subject || !Array.isArray(subject) || subject.length === 0) throw new HttpError('Invalid subject', 400) 
        //- Question types is valid
        if(!qTypes || !qTypes.every(q => questionTypes.includes(q))) throw new HttpError('Invalid question types', 400)
        //- File type is valid 
        if(!file_type || !['image', 'text'].some(f => f === file_type)) throw new HttpError('Invalid file type', 400)
        //- Credits are preCalculated
        if(!req.credits) throw new HttpError('Something went wrong, please try again.', 500);        
        //- User credits are sufficient to procceed task 
        const credits = req.credits;
            //Get and validate userbase
            const usersBase = await getCollection<User>('users');
            if(!usersBase) throw new HttpError('Could not connect to database', 500)
            //Check whether user has enough credits for the task 
            const userCredits = (await usersBase.findOne({_id: new ObjectId(uid)}, {projection: {credits: 1}}))?.credits;
            if(!userCredits && userCredits !== 0) throw new HttpError('Could not fetch user credits', 500);    
            if(userCredits < credits) throw new HttpError("Insufficient Credits.", 402)

    
        //Prompt subject(array of extracted text from file) to llm in parallel(sync) 
        const request = subject.slice(0, 10).map((page: string) => ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: clearUpPrompt({
                            subject: page,
                            qTypes,
                            prev: ''
                        }),
        }))
        
        //Await all the llm responses in parallel
        const response = await Promise.all(request);
        const questions = response.flatMap(q => {            
            //declutter llm response and parse it into a valid json
            const string = String(q.text).replaceAll('`', '').replaceAll('\n', '').replace('json', '');            
            const parsed = JSON.parse(string)            
            return parsed.questions;
        })

        
        if(questions.length <= 0) throw new HttpError("Something went wrong", 400)



        //Set up clear up
        const clearUp: ClearUp = {
            uid: String(uid), // user mongodb _id
            type: "Clear-up", // the process/service (clearup or quiz) created from 
            created_at: new Date().toISOString(), // creation date
            title: file?.originalname || `Quiz-${Date.now()}`, // title
            generated_from: `${file_type as "image" | "text" } pdf`, // file type subject was extracted from 
            question_types: qTypes,
            number: questions.length, // number of questions
            credits, // credits used for this process
            questions, // the actuall generated questions
        }
        
        //Store quiz in db 
        const quizHistories = await getCollection<ClearUp>('quizHistories')
        if(!quizHistories) throw new HttpError('Could not connect to database', 500);
        const {acknowledged} = await quizHistories?.insertOne(clearUp)
        if(!acknowledged) throw new HttpError('Could not store clear up data', 500);
        //Subtract credits
        subtractUserCredits(credits, String(uid))
        if(!clearUp.credits || !uid) throw new HttpError('Something went wrong, please try again.', 500);
        
        res.status(201).json(clearUp)
        return;

    } catch (error) {
        return next(error)
    }
}


        





