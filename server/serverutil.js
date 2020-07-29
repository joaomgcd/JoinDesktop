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
        // console.log("Getting file path", result)
        return result;
    }
    static async getUserDataFilePath(relativePath){        
        const userDataPath = (electron.app || electron.remote.app).getPath('userData');
        const result =  path.join(userDataPath, relativePath);
        return result;
    }
        
    static async downloadFile(url,relativeLocalPath){
        return new Promise(async (resolve,reject)=>{
            const http = url.startsWith("https") ? require('https') : require('http');
            const fs = require('fs');

            const dest = await UtilServer.getUserDataFilePath(relativeLocalPath);
            console.log("Downloading file",url, dest);
            let downloaded = 0;
            const file = fs.createWriteStream(dest);
            http.get(url, (response)=>{
                response.pipe(file);
                file.on('finish', ()=>{
                    file.close(()=>resolve(file));
                });
                response.on("data",chunk=>{
                    downloaded += chunk.length;
                    let toDisplay = downloaded / 1024 / 1024;
                    toDisplay = Math.round((toDisplay + Number.EPSILON) * 100) / 100;
                    process.stdout.write(`Downloaded ${toDisplay}MB\r`);
                });
            }).on('error', (err)=>{ 
                fs.unlink(dest);
                reject(err);
            });
        })
    }
        
    static async urlExists(url){
        const urlExist = require("url-exist");
        return await urlExist(url);
    }
    static openUrlOrFile(urlOrFile){        
        const { shell } = require('electron')
        if(urlOrFile.path){
            urlOrFile = urlOrFile.path;
        }
        shell.openExternal(urlOrFile);
    }
    static get myIp(){
        const networkInterfaces = require('os').networkInterfaces();
        const ipv4s = Object.keys(networkInterfaces).map(key => networkInterfaces[key]).flat().filter(networkInterface => networkInterface.family == "IPv4" && !networkInterface.internal);
        if(ipv4s.length == 0) return null;

        return ipv4s.slice(-1)[0].address;
    }
}