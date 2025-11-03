import pdf from "pdf-parse";
import fs from 'fs';
import fsPromise from 'fs/promises';
import path from 'path';
import Tesseract, {createWorker} from "tesseract.js";
import { Poppler } from "node-poppler";
import { maxClearUpPages, maxNumOfPagesPerPdf, minTextPdfCharLength } from "../constants/constriants.constants";
import { HttpError } from "../errors/http-error";


export async function parsePdf(file: Express.Multer.File | undefined){
    if(!file) throw new HttpError('No file uploaded', 400)
    const filePath = file.path;
    try{    
        const buffer = fs.readFileSync(filePath)
        // console.log(filePath, file);
        const {text, numpages} = (await pdf(buffer));

        //If file characters are bellow minimum length throw an error
        if(text.length < minTextPdfCharLength)  
            throw new HttpError(`File must have more than ${minTextPdfCharLength} characters.`, 400); 
        
        //If file pages exceed maximum number throw an error
        if(numpages > maxNumOfPagesPerPdf) 
            throw new HttpError(`Invalid number of pages. Maximum allowed number of pages is ${maxNumOfPagesPerPdf} pages`, 400); 


        
        fs.unlinkSync(filePath)
        return text.split(/\f/);
    }catch(error){
        fs.unlinkSync(filePath)
        throw error;
    }
}



export async function ocrScanPdf(file: Express.Multer.File | undefined){
    let text = '';
    let imagesFolder = '';
    if(!file) throw new HttpError('No file uploaded', 400)

    try {        
        const {pages, imagesfolderPath} = await convertPagesToImages(file);
        imagesFolder = imagesfolderPath;
        for(let i = 1; i <= pages.new; i++){
            const worker = await createWorker();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const ImagePath = `${imagesfolderPath}/img-${"0".repeat(digitCount(pages.original) - digitCount(i)) + i.toString()}.png`
            text += (await worker.recognize(ImagePath)).data.text;
            worker.terminate();
        }

        fs.unlinkSync(file.path); // delete uploaded pdf file
        fs.rmSync(imagesfolderPath, { recursive: true }); // delete images folder and its content
        return text.split(/\f/); // return text as array of strings split by new line
    } catch (error) {
        fs.unlinkSync(file.path); // delete uploaded pdf file
        fs.rmSync(imagesFolder, { recursive: true }); // delete images folder and its content
        throw error   
    }
}

export async function convertPagesToImages(file: Express.Multer.File){

    
    if(!file) throw new HttpError('No file uploaded', 400)

    try{
        //Images folder path
        const filePath = file.path;        
        const imagesFolderName = `${Math.floor(Math.random() * 100) + Date.now()}`; 
        const outputDir = path.dirname(filePath);
        const imagesfolderPath = path.join(__dirname, '../../', outputDir, imagesFolderName);
            
        //Read PDF pages
        const buffer = fs.readFileSync(filePath)
        const {numpages} = await pdf(buffer);
        const pdfFilePages = {new: numpages > 5 ? 5 : numpages, original: numpages};
        
        //Create the image pages folder
        fs.mkdirSync(imagesfolderPath)

        // Convert PDF → images    
        const poppler = new Poppler();
        await poppler.pdfToCairo(filePath, imagesfolderPath + "/img" , { pngFile: true, lastPageToConvert: pdfFilePages.new })

        return {pages: pdfFilePages, imagesfolderPath};
    }catch(error){
        console.log(error);
        throw error;
    }        

}



export async function clearUpUploadsFolder(){
    
    const uploadsFolderPath = path.resolve('./uploads');
    await fsPromise.rm(uploadsFolderPath, { recursive: true, force: true });
    await fsPromise.mkdir(uploadsFolderPath, { recursive: true }); // recreate uploads folder after deletion
}


//Calculates the number of digits of a Number
//Used to loop throug images folder
export function digitCount(num: number){
    return Math.floor(Math.log10(Math.abs(num)))
}
//Reason:  if the images folder has xxx number of images
//they will be stored by pdfPoppler as document-(001...xxx)
//for the i^th image in the folder the document will be named as document-00i, document-0ii, or document-iii. (ex. 35^th image --> document-035)
