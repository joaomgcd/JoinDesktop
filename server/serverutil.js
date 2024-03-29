import { Util } from '../v2/util.js';
import { url } from 'inspector';

const electron = require('electron');
const { nativeImage} = electron;
const fs = require('fs');
const path = require('path');

const fetch = require('node-fetch');
const promiseLocalIp = new Promise((resolve,reject)=>{
    const network = require('network');
    console.log("Checking local ip...");
    network.get_private_ip((error,ip)=>{
        console.log("Got IP",error,ip);
        if(error){
            reject(error);
        }else{
            resolve(ip);
        }
    })
    /*const networkInterfaces = require('os').networkInterfaces();
    const ipv4s = Object.keys(networkInterfaces).map(key => networkInterfaces[key]).flat().filter(networkInterface => networkInterface.family == "IPv4" && !networkInterface.internal);
    if(ipv4s.length == 0) return null;

    return ipv4s.slice(-1)[0].address;*/
});
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
        const util = require('util')
        const fs = require('fs')
        const streamPipeline = util.promisify(require('stream').pipeline)

        const response = await fetch(url)
        if (!response.ok) throw new Error(`unexpected response ${response.statusText}`)

        const dest = await UtilServer.getUserDataFilePath(relativeLocalPath);
        const file = fs.createWriteStream(dest);
        await streamPipeline(response.body, file)
        return file;
    }
        
    static async urlExists(url){
        const urlExist = require("url-exist");
        return await urlExist(url);
    }
    static openUrlOrFile(urlOrFile,needsFilePrefix){        
        const { shell } = require('electron')
        if(urlOrFile.path){
            urlOrFile = urlOrFile.path;
        }
        if(needsFilePrefix){
            urlOrFile = `file://${urlOrFile}`
        }
        if(!urlOrFile.includes("://")){
            urlOrFile = `https://${urlOrFile}`;
        }
        console.log("Opening url or file",urlOrFile)
        shell.openExternal(urlOrFile);
    }
    static get myIp(){
        return promiseLocalIp;
        // return new Promise((resolve,reject)=>{
        //     const network = require('network');
        //     console.log("Checking local ip...");
        //     network.get_private_ip((error,ip)=>{
        //         console.log("Got IP",error,ip);
        //         if(error){
        //             reject(error);
        //         }else{
        //             resolve(ip);
        //         }
        //     })
        //     /*const networkInterfaces = require('os').networkInterfaces();
        //     const ipv4s = Object.keys(networkInterfaces).map(key => networkInterfaces[key]).flat().filter(networkInterface => networkInterface.family == "IPv4" && !networkInterface.internal);
        //     if(ipv4s.length == 0) return null;
    
        //     return ipv4s.slice(-1)[0].address;*/
        // });
    }
}