import { Request, Response, NextFunction } from "express";
import { ocrScanPdf, parsePdf } from "../utils/files";
import pdf from "pdf-parse";
import fs from "fs";
import { HttpError } from "../errors/http-error";
import { creditsPerPage } from "../constants/credits.constants";


export interface CreditsRequest extends Request{
    credits?: number
}

export async function processFile(req: CreditsRequest, res: Response, next: NextFunction){
    const { file, body } = req;
    const file_type = body.file_type as "image" | "text";

    
    
    try{
        if(!file) throw new HttpError('File not provided.', 400);

        console.log(body);
        
        const buffer = fs.readFileSync(file.path)
        const {numpages} = await pdf(buffer);


        let subject: string[] = [];
        console.log(req.path);
        
        if(file_type === "image" && req.path === "/clearup") {
            subject = await ocrScanPdf(file);
            req.credits = Number((creditsPerPage.imagePDF * numpages).toFixed(2))
        }

        if(file_type === "text") {            
            subject = await parsePdf(file)
            req.credits = Number((creditsPerPage.textPDF * numpages).toFixed(2))

        }

        if (subject.length === 0) throw new HttpError('No text extracted from file.', 400);
        req.body.subject = subject;
        return next()
    }catch(error){
        return next(error);
    }
}
