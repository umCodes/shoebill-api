import express from 'express';

//Utilities
import cors from "cors";
import cookiePraser from "cookie-parser";

//Routes
import quizRouter from './routes/quiz.routes';
import authRouter from './routes/auth.routes';
import fileRouter  from './routes/file.routes';
import userRouter  from './routes/user.routes';

//Middlewares
import { errorHandler } from './middlewares/error-handler.middlewares';
import { authenticateToken, refreshTokens } from './middlewares/auth-handler.middlewares';

//Database
import { connectToDB } from './db/db';
import clearUpRouter from './routes/clear-up.routes';
import { ORIGIN, PORT } from './constants/env';



import { createWorker } from 'tesseract.js';
import path from 'path';

(async () => {
    const worker = await createWorker(); // specify language (English)
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    const imagePath = path.join( __dirname, "../", "/uploads", 'images.png');
    const { data: { text } } = await worker.recognize(imagePath);
    console.log(text);

    await worker.terminate()
});



const app = express();

app.set('trust proxy', true);
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.urlencoded({ extended: true }));

app.use(cookiePraser())
app.use(express.json())
app.use('/auth', authRouter)
app.use(refreshTokens, authenticateToken)
app.use('/api', fileRouter);
app.use('/api', clearUpRouter);
app.use('/api', quizRouter)
app.use('/', userRouter)
app.use(errorHandler)


export const database = (async () =>{
    const db = await connectToDB();
    if(db)
        app.listen(PORT, () => console.log(`Server runnig on port ${PORT}`));    
    return db;
})();





