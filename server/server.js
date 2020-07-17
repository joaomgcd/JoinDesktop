const http = require('http');
import {createHttpTerminator} from 'http-terminator';
var url = require('url');
const {GCMServer} = require("./gcmserver.js");
const {ClipboardChecker} = require("./clipboardchecker.js");
const { globalShortcut,ipcMain ,shell,app,nativeImage,BrowserWindow,Tray } = require('electron')
const {GoogleAuth} = require('./googleauth.js');
const {ServerNotification} = require('./servernotification.js');
const {EventBus} = require("../v2/eventbus.js")
import { DevicesServer } from "./serverdevices.js";
import { AppContext } from "../v2/appcontext.js";
import { SettingCompanionAppPortToReceive } from '../v2/settings/setting.js';
import { Util } from '../v2/util.js';
import { ServerKeyboardShortcuts } from './serverkeyboardshortcut.js';
const path = require('path')
const Store = require('./store.js');
const storeWindowBounds = new Store({
    configName: 'window',
    defaults: {}
});


const getRequestBody = request=>{
    return new Promise(resolve=>{
      let body = [];
      request.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        try{
          body = JSON.parse(body);
        }catch{}
        resolve(body);
      });
    });
  }
class Server{
    constructor(){
    }
    async createServer(){
        if(this.httpTerminator){
            await this.httpTerminator.terminate();
        }
        const port = AppContext.context.localStorage.get(SettingCompanionAppPortToReceive.id);
        if(!port){
            console.log("Not creating server. No port yet.")
            return;
        }
        this.httpServer = http.createServer((req, res)=>this.onRequest(req, res));
        this.httpTerminator = createHttpTerminator({server:this.httpServer});
        this.httpServer.listen(port,e=>{
            console.log(this.httpServer.address().port);
        });
    }
    async createWindow() {
  
        // const {UtilServer} = await import("./server/serverutil.js")
        // const iconPath = UtilServer.getServerFilePath(`../images/join.png`);
        
        // Create the browser window.
        const bounds = storeWindowBounds.getData();
        if(!bounds.width){
            bounds.width = 750;
        }
        if(!bounds.height){
            bounds.height = 800;
        }
        const args = {
            frame: false, 
            icon: appIcon,   
            webPreferences: {
              contextIsolation: true,
              enableRemoteModule: false,
              preload: path.join(__dirname, '../preload.js'),
              allowRunningInsecureContent: true
            }
        }
        Object.assign(args,bounds);
        const mainWindow = new BrowserWindow(args)
        mainWindow.on("close",()=>{
            const bounds = mainWindow.getBounds();
            storeWindowBounds.setData(bounds);
            // storeSettings.set("width",)
        });
        // and load the index.html of the app.
        mainWindow.loadFile('index.html')
      
        // Open the DevTools.
        //mainWindow.webContents.toggleDevTools()
        this.window = mainWindow;
        return mainWindow;
    }
    async bringWindowToFront(){
        if(!this.window) return;
      
        this.window.show();
        if(this.window.isMinimized()){
          this.window.restore();
        }
    
        this.window.setAlwaysOnTop(true);
        this.window.focus();
        await Util.sleep(1000);
        this.window.setAlwaysOnTop(false);
    }
    get isWindowsSystem(){
        const os = require('os');
        return os.platform() == "win32";
    }
    async load(){        
        if(this.isWindowsSystem){
            const tray = new Tray(appIcon);
            tray.on("click",async()=>{
                await this.bringWindowToFront();
            });
        }
        app.on('second-instance',async ()=> await this.bringWindowToFront());
        await this.createWindow();
        AppContext.context.serverStorePath = __dirname + "/store.js"
        EventBus.register(this);
        await this.createServer();
        this.clipboardChecker = new ClipboardChecker(1000,text=>{
            this.sendToPageEventBus(new ClipboardChanged(text));
        });
        this.clipboardChecker.start();
        
        
        
        ipcMain.on("authToken",async (event,args)=>{
            // console.log("Received request for AuthToken", args);
            const authToken = await GoogleAuth.accessToken;
            // console.log("Responsing with Token",authToken);
            this.window.webContents.send('authToken', authToken);
        });
        ipcMain.on("notification",async (event,args)=>{
            // console.log("Received request for Notification", args);
            args.authToken = await GoogleAuth.accessToken;
            const notification = new ServerNotification(args);
            notification.show().catch(error=>console.log("ipcMain Notification error",error));
        });
        ipcMain.on("gcm", async (event,{type,json}) => {
            const gcmRaw = {type,json};
            console.log("Received gcmraw from page",gcmRaw)
            await this.sendToPage(gcmRaw);
        });
        ipcMain.on("openurl",async (event,url)=>{
            shell.openExternal(url);
        });
        ipcMain.on("devices",async (event,raw)=>{
            DevicesServer.devices = raw;
        });
        ipcMain.on("setting",async (event,setting)=>{
            AppContext.context.localStorage.set(setting.key,setting.value);
            if(setting.key == SettingCompanionAppPortToReceive.id){
                await this.createServer();
            }
        });
        ipcMain.on("eventbus",async (event,{data,className}) => {
            // console.log("Sending to eventbus from web page",data,className)
            await EventBus.post(data,className);
        });
        // await ServerKeyboardShortcuts.clearShortcuts();
        
        return this.window;
        // const path = require('path');
        // ServerNotification.show({title:"Join Companion App",body:"Now running!",icon:path.join(__dirname, '../images/join.png'),actions:[{title:"Test Action"}]});
    }
    async onRequestListenForShortcuts(request){
        const shortcuts = request.shortcuts;
        ServerKeyboardShortcuts.storeShortcuts(shortcuts);
    }
    async onRequestFocusWindow(){
        console.log("Requested to bring window to front");
        await this.bringWindowToFront();
    }
    async onShortcutPressed(shortcut){
        await this.sendToPageEventBus(shortcut);
    }
    async onRequestClipboard(){
        this.sendToPageEventBus(new ResponseClipboard(this.clipboardChecker.get()))
    }
    async onRequestToggleDevOptions(){
        this.window.webContents.toggleDevTools()
    }
    async onGCMAutoClipboard(gcm){
        this.clipboardChecker.setClipboardText(gcm.text);
        const notification = new ServerNotification({
            id:"autoclipboard",
            title:"Clipboard Automatically Set",
            text:gcm.text
        });
        notification.show().catch(error=>console.log("onGCMAutoClipboard Notification error",error));

    }
    async onCloseAppClicked(){
        app.quit();
    }
    async onMinimizeAppClicked(){
        this.window.minimize();
        if(this.isWindowsSystem){
            this.window.hide();
        }
    }
    async onRequestSendPush(request){
        await this.window.webContents.send('sendpush', request.push);
    }
    async onCompanionHostConnected(info){
        await this.sendToPageEventBus(info);
    }
    async sendToPageEventBus(object){
        await this.window.webContents.send('eventbus', {data:object,className:object.constructor.name});
    }
    async handleAuthenticationRequest({code,res}){       
        try{
            const authData = await GoogleAuth.storeAuthData(code)   
            const isExpired = authData.isExpired;      
            console.log("Is Expired",isExpired);  
            if(!isExpired){
                this.window.webContents.send('usersignedin');
                await this.bringWindowToFront();
            }
            res.writeHead(200);
            res.end(`<script>window.close()</script>`);
        }catch(error){
            console.error(error);
            res.writeHead(500);
            res.end(JSON.stringify(error));
        }
    }
    async onRequest(req, res){
        res.setHeader("Access-Control-Allow-Origin","*")
        res.setHeader("Access-Control-Allow-Methods","*")
        res.setHeader("Access-Control-Allow-Headers","*")
        var queryData = url.parse(req.url, true).query;

        console.log(req.method,req.url)
        const code = queryData.code;
        if(code){
            return await this.handleAuthenticationRequest({code:queryData.code,res})
        }

        try{
            const body = await getRequestBody(req);
            // console.log(req)
            await this.sendToPage(body);
        }catch(error){
            console.error("Couldn't process request",error);

            res.writeHead(503);
            res.end(JSON.stringify({success:false}));
            return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({success:true}));
        
    }
    async sendToPage(content){
        if(!content.type || !content.json){
            await this.window.webContents.send('log', content);
            return;
        }
        const gcm = await GCMServer.getGCMFromJson(content.type,content.json);
        if(gcm){
            if(gcm.push && gcm.push.clipboard){
                this.clipboardChecker.lastText = gcm.push.clipboard;
            }
            content = gcm;
            if(gcm.execute){
                await gcm.execute();
            }
            delete gcm.execute;
            if(gcm.modifyNotification){
                const notification = {authToken: await GoogleAuth.accessToken};
                await gcm.modifyNotification(notification,0);
                ServerNotification.show(notification).then(action=>gcm.handleNotificationClick(null,action)).catch(error=>console.log("Notification error",error));
            }
            // console.log("Sending to page",content);
            await this.window.webContents.send('gcm', content);
            return;
        }
    }
}
class ClipboardChanged{
    constructor(text){
        this.text = text;
    }
}
class ResponseClipboard{
    constructor(text){
        this.text = text;
    }
}
exports.Server = Server;
const appIcon = nativeImage.createFromDataURL(`data:image/png;base64,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`)