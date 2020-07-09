import { Util } from '../v2/util.js';

const electron = require('electron');
const { nativeImage} = electron;
const fs = require('fs');
const path = require('path');

const fetch = require('node-fetch');

export class UtilServer{
    static async imageToFilePath(id,imageString,authToken){
        if(!imageString) return imageString;

        const dataUrl = Util.isBase64ImageUrl(imageString) ? imageString : await UtilServer.getImageAsBase64(imageString,authToken);
        const image = nativeImage.createFromDataURL(dataUrl);
        const userDataPath = (electron.app || electron.remote.app).getPath('userData');
        const dir = path.join(userDataPath, `/tempimages/`);
        if (!fs.existsSync(dir)){
            console.log("Creating temp images dir",dir);
            fs.mkdirSync(dir);
        }
        const fileToWrite = path.join(dir, `${id}.png`);
        console.log("Writing image to",fileToWrite,image);
        fs.writeFileSync(fileToWrite, await image.toPNG());
        return fileToWrite;
    }
    static async deleteFile(path){
        if(!path) return;

        try{
            fs.unlinkSync(path);
            console.log("Deleted file",path);
        }catch{}
    }
    static async getImageAsBase64(url,authToken) {   
        const headers = {};
        if(authToken){
            headers['Authorization'] ='Bearer ' + authToken;
        }
        const options = {
            headers
        }
        const result = await fetch(url,options);
        const arrayBuffer = await result.arrayBuffer();
        const base64Image = Util.arrayBufferToBase64(arrayBuffer);
        return Util.getBase64ImageUrl(base64Image);
    }
    static async getServerFilePath(relativePath){
        const result =  path.join(__dirname, relativePath);
        console.log("Getting file path", result)
        return result;
    }
}