import crypto from "crypto";
import jwt from "jsonwebtoken";
import { HttpError } from "../errors/http-error";
import { signatures } from "./env";
import { NextFunction, Request, Response } from "express";
import { getCollection } from "../db/db";
import { ObjectId } from "mongodb";
import { UserPayload } from "../models/jwt.types";
import { User } from "../models/user.types";

export async function storeTokensInCookies(res: Response, tokens: {access?: string, refresh?: string}, uid: string){
    //Send tokens to client in cookies
    if(tokens?.access)
    res.cookie("access-token", tokens.access, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 24 * 7 //1 week
    });

    if(tokens?.refresh){
        res.cookie("refresh-token", tokens.refresh, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 1000 * 60 * 60 * 24 * 7 //1 week
        }); 
        
        //Save referesh token in db
        const userBase = await getCollection('users');
        if(!userBase) throw new HttpError('Could not connect to database', 500);
        const user = await userBase.findOne({_id: new ObjectId(uid)});
        if(!user) throw new HttpError('User not found', 404);
        await userBase.updateOne(
            { _id: new ObjectId(uid) }, 
            { $push: { refreshTokens: hashToken(tokens.refresh, signatures.tokensStorage) } }
        );
    }
} 

export function hashToken(token: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function compareTokens(token1: string, token2: string) {
    const uid1 = (jwt.decode(token1) as UserPayload).uid;
    const uid2 = (jwt.decode(token2) as UserPayload).uid;
    return uid1 === uid2;
}

export async function clearDBRefreshToken(uid: string, refreshToken: string){
    try {
        console.log(uid);
        if(!uid) throw new Error('user not provided');
        //Get Database...
        const userBase = await getCollection<User>('users');
        if(!userBase) throw new Error('Could not connect to database');
        //Find user with uid
        
        const user = await userBase.findOne({_id: new ObjectId(uid)});
        //compare each encrypted refresh token in db with .cookies['refresh-token']
        //then remove the matching one from refresh tokens list in db
        user?.refresh_tokens?.forEach(hashedtoken =>{
            //Find client's old refresh token within refresh_tokens[...hashedTokens]
                if(hashToken(refreshToken, signatures.tokensStorage) === hashedtoken)
                //if matching, clear hashedtoken from refresh_tokens[...hashedTokens]
                userBase
                .updateOne(
                    { _id: new ObjectId(uid)}, 
                    {$pull : {refresh_tokens: hashedtoken}}
                );           
    })
        
    } catch (error) {
        console.error('🔴 error clearing refresh token at ./utils/tokens.ts -> clearDBRefreshToken(): ');
        throw error;
    }
}


export async function verifyTokens(req: Request, res: Response, next: NextFunction) {
    
    //Get access token
    const token = String(req.cookies["access-token"]);
    
    //Throws an error if token doesn't exist
     if(!token){
        return next(new HttpError("Please provide an access token.", 400));
    }


    //Verify token
    jwt.verify(token, signatures.accessToken, async (err, decoded) =>{
        console.log(err, "no error");
        if(err) return next(new HttpError('Access Forbidden', 403));
        
        
        // req.user = {uid: (decoded).uid};
        // console.log(req.user);
        
        next();
        return;
    })
   
}