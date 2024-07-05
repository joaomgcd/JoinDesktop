const http = require('http');
import {createHttpTerminator} from 'http-terminator';
var url = require('url');
const {GCMServer} = require("./gcmserver.js");
const {ClipboardChecker} = require("./clipboardchecker.js");
const { globalShortcut,ipcMain ,app,nativeImage,BrowserWindow,Tray,Menu, MenuItem,nativeTheme,screen } = require('electron')
const {GoogleAuth} = require('./googleauth.js');
const {ServerNotification} = require('./servernotification.js');
const {EventBus} = require("../v2/eventbus.js")
import { DevicesServer } from "./serverdevices.js";
import { AppContext } from "../v2/appcontext.js";
import { SettingCompanionAppPortToReceive, SettingHideTextInNotifications } from '../v2/settings/setting.js';
import { Util } from '../v2/util.js';
import { ServerKeyboardShortcuts } from './serverkeyboardshortcut.js';
import { AutoUpdater } from './autoupdater.js';
import { UtilServer } from './serverutil.js';
import { CommandLine } from './commandline.js';

const path = require('path')
const Store = require('./store.js');
const AutoLaunch = require('auto-launch');

const storeWindowBounds = new Store({
    configName: 'window',
    defaults: {}
});

class ResponseAppVersion{
    constructor(platform,version){
        this.platform = platform;
        this.version = version;
    }
}

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
  /** @type {Tray} */
let tray = null;
class Server{
    constructor(){
    }
    get serverPort(){
        return AppContext.context.localStorage.get(SettingCompanionAppPortToReceive.id);
    }
    get hideTextInNotifications(){
        return AppContext.context.localStorage.get(SettingHideTextInNotifications.id);
    }
    async createServer(){
        if(this.httpTerminator){
            await this.httpTerminator.terminate();
        }
        const port = this.serverPort;
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
        let bounds = storeWindowBounds.getData();
        console.log("Stored bounds",bounds);
        console.log("Primary display", screen.getPrimaryDisplay().workArea);
        if(!bounds.width){
            bounds.width = 750;
        }
        if(!bounds.height){
            bounds.height = 800;
        }
        // if(bounds.width > 1920 || bounds.height > 1080){
        //     console.log("resetting bounds");
        //     bounds = {x:500,y:500,width:750,height:800};
        // }
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
            console.log("Fetched bounds",bounds);
            bounds.x += 8;
            bounds.y += 8;
            bounds.width -= 16;
            bounds.height -= 16;
            // if(bounds.x < 0){
            //     const offset = bounds.x;
            //     bounds.x = 0;
            //     bounds.width = bounds.width + (2 * offset);
            // }
            // if(bounds.y < 0){
            //     const offset = bounds.y;
            //     bounds.y = 0;
            //     bounds.height = bounds.height + (2 * offset);
            // }
            console.log("Storing bounds",bounds);
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
        return this.autoUpdater.isWindowsSystem;
    }
    get isMacSystem(){
        return this.autoUpdater.isMacSystem;
    }
    async load(){   
        this.autoUpdater = new AutoUpdater(app);     
        if(this.isWindowsSystem){
            console.log("Is Windows. Will create tray icon!");
            tray = new Tray(appIcon);
            tray.on("click",async()=>{
                await this.bringWindowToFront();
            });
            tray.setContextMenu(Menu.buildFromTemplate([
                new MenuItem({ label: 'Exit', type: 'normal', click:()=>this.onCloseAppClicked() })
            ]))
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
        const appPath = process.execPath;
        console.log(`Instancing AutoLaunch for path ${appPath}`);
        this.autoLaunch = new AutoLaunch({
            name: 'Join Desktop',
            path: appPath,
          });
        
        
        
        ipcMain.on("authToken",async (event,args)=>{
            // console.log("Received request for AuthToken", args);
            const authToken = await GoogleAuth.accessToken;
            // console.log("Responsing with Token",authToken);
            this.window.webContents.send('authToken', authToken);
        });
        ipcMain.on("notification",async (event,args={notification,gcmRaw})=>{
            const {type,json} = args.gcmRaw;
            const gcm = await GCMServer.getGCMFromJson(type,json);
            // console.log("Received request for Notification", gcm);
            if(gcm.modifyNotification){
                gcm.modifyNotification(args.notification,0);
            }
            args.notification.senderId = gcm.senderId;
            args.notification.authToken = await GoogleAuth.accessToken;
            args.notification.hideText = this.hideTextInNotifications;
            const notification = new ServerNotification(args.notification);
            notification.show(async action=>{
                console.log("Performing action!",action,type);
                if(gcm.handleNotificationClick){
                    gcm.handleNotificationClick(null,action);
                }
            }).catch(error=>console.log("ipcMain Notification error",error));
        });
        ipcMain.on("gcm", async (event,{type,json}) => {
            const gcmRaw = {type,json};
            // console.log("Received gcmraw from page",gcmRaw)
            await this.sendToPage(gcmRaw);
        });
        ipcMain.on("openurl",async (event,url)=>{
            UtilServer.openUrlOrFile(url);
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
        
        // ServerNotification.show({title:"Join Companion App1",body:"Now running1!"});
        this.autoUpdater.checkForUpdate();
        return this.window;
        // const path = require('path');
    }
    async onResultNotificationAction(request){
        await this.sendToPageEventBus(request)
    }
    async onRequestReplyMessageFromServer(request){
        // console.log("Received reply request in server",request);
        await this.sendToPageEventBus(request)
    }
    async onNotificationInfos(notificationInfos){
        await this.sendToPageEventBus(notificationInfos)
    }
    async onStoredNotifications(storedNotifications){
        const image = storedNotifications && storedNotifications.options && storedNotifications.options.length > 0 ? appIconWithNotifications : appIcon;
        tray.setImage(image);
        await this.sendToPageEventBus(storedNotifications)
    }
    async onExistingNotifications(){
        console.log("Setting app icon with notifications");
        tray.setImage(appIconWithNotifications);
    }
    async onNoNotifications(){
        console.log("Setting normal app icon");
        tray.setImage(appIcon);
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
    async onRequestSetClipboard(request){
        this.clipboardChecker.setClipboardText(request.text);
    }
    async onRequestAutoLaunchState(){
        const isEnabled = await this.autoLaunch.isEnabled();
        this.sendToPageEventBus(new ResponseAutoLaunchState(isEnabled,process.execPath))
    }
    async onRequestListDisplays(){
        const displays = screen.getAllDisplays();
        for(const display of displays){
            if(display.bounds.x < 0){
                display.label = "Left";
            }
            if(display.bounds.x > 0){
                display.label = "Right";
            }
            if(display.bounds.x == 0){
                display.label = "Main";
                display.isMain = true;
            }else{                
                display.isMain = false;
            }
        }
        this.sendToPageEventBus(new ResponseListDisplays(displays))
    }
    async onRequestToggleAutoLaunch(request){
        const enableRequest = request.enable;
        if(enableRequest === null || enableRequest === undefined) return;

        console.log(`Requested autolaunch: ${enableRequest}`);
        const isEnabled = await this.autoLaunch.isEnabled();
        console.log(`Was autolaunch enabled: ${isEnabled}`);
        if (isEnabled == enableRequest) return;

        if(enableRequest){
            console.log(`Enabling autolaunch`);
            await this.autoLaunch.enable();
        }else{
            console.log(`Disabling autolaunch`);
            await this.autoLaunch.disable();
        }
    }
    async onRequestToggleHideTextInNotifications(request){
        AppContext.context.localStorage
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
        if(this.isWindowsSystem){
            this.window.minimize();
            this.window.hide();
            // tray.displayBalloon({title:"Still Running",content:"To close Join right click this icon."})
        }else{

            this.onCloseAppClicked();
        }
    }
    async onMinimizeToTaskBarAppClicked(args = {hideWindowIfWindows}){
        if(args.hideWindowIfWindows && this.isWindowsSystem){
            console.log("Is Windows and wants to hide window...")
            await this.onMinimizeAppClicked();
            return;
        }
        this.window.minimize();
    }
    async onRequestSendPush(request){
        await this.window.webContents.send('sendpush', request.push);
    }
    async onRequestSendGCM(request){
        await this.sendToPageEventBus(request);
    }
    async onRequestSystemTheme(request){
        await this.sendToPageEventBus(new ResponseSystemTheme(nativeTheme.shouldUseDarkColors));
    }
    async onRequestDownloadAndOpenFile(request){
        const path = require("path");
        
        const downloadLink = request.url;
        const parsed = url.parse(downloadLink);
        let fileName = decodeURIComponent(path.basename(parsed.pathname));
        console.log("Downloading file", downloadLink, fileName);
        
        const file = await UtilServer.downloadFile(downloadLink,fileName)
        console.log("Downloaded file", file.path);
        UtilServer.openUrlOrFile(file);
    }
    get appInfo(){
        return (async ()=>{
            const response = new ResponseAppVersion();
            Object.assign(response,this.autoUpdater.appInfo);
            const port = this.serverPort;
            if(port){
                response.ipAddress = await response.ipAddress;
                console.log(`IP Address: ${response.ipAddress}`)
                response.serverAddress = `http://${response.ipAddress}:${port}/`
            }
            return response;
        })();
    }
    async onRequestAppVersion(){
        const appInfo = await this.appInfo;
        await this.sendToPageEventBus(appInfo);
    }
    async onRequestExecuteGCMOnPage(request){
        await this.sendToPageEventBus(request);
    }
    async onUpdateAvailable(request){
        await this.sendToPageEventBus(request);
    }
    async onRequestHandleNotificationClickGCMOnPage(request){
        await this.sendToPageEventBus(request);
    }
    async onCompanionHostConnected(info){
        await this.sendToPageEventBus(info);
    }
    async onRequestRunCommandLineCommand({command,args}){
        if(!command){
            console.log("Won't run empty command line command");
            return;
        }
        console.log("Running command line",command,args);
        try{
            const result = await CommandLine.run(command,args);
            console.log("Command line result",result);
            await this.sendToPageEventBus(new ResponseRunCommandLineCommand(result));
        }catch(error){
            console.log("Command line error",error);
            error = JSON.stringify(error);
            error = JSON.parse(error);
            await this.sendToPageEventBus(new ResponseRunCommandLineCommand(error));
        }
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
            // if(gcm.modifyNotification){
            //     // console.log("Modifying notification and handling click");
            //     const notification = {authToken: await GoogleAuth.accessToken};
            //     await gcm.modifyNotification(notification,0);
            //     ServerNotification.show(notification).then(action=>{
            //         console.log("Got Notification action!",action)
            //         gcm.handleNotificationClick(null,action);
            //     }).catch(error=>console.log("Notification error",error));
            // }
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
class ResponseAutoLaunchState{
    constructor(enabled,execPath){
        this.enabled = enabled;
        this.execPath = execPath;
    }
}
class ResponseListDisplays{
    constructor(displays){
        this.displays = displays
    }
}
class ResponseSystemTheme{
    constructor(isDark){
        this.isDark = isDark;
    }
}
class ResponseRunCommandLineCommand{
    constructor(result){
        Object.assign(this,result);
    }
}
exports.Server = Server;
const appIcon = nativeImage.createFromDataURL(`data:image/png;base64,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`)
const appIconWithNotifications = nativeImage.createFromDataURL(`data:image/png;base64,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Zy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgIHhtcE1NOkRvY3VtZW50SUQ9ImdpbXA6ZG9jaWQ6Z2ltcDo2MjA0ZDQ0OC03OWI5LTQyZDctOWEzZS1kYjliOGM4YTQwYmQiCiAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MTNkY2EyZmUtMTJlZC00ODNkLWEyNTEtNWI1ZmI2M2M0NDBjIgogICB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6YTAzZGY3ODAtNWY1Mi00YzEwLTlmMTEtOTFkZmI4OTA3ZGNhIgogICBHSU1QOkFQST0iMi4wIgogICBHSU1QOlBsYXRmb3JtPSJXaW5kb3dzIgogICBHSU1QOlRpbWVTdGFtcD0iMTYzMzcxNDUzNzM5MDAxNSIKICAgR0lNUDpWZXJzaW9uPSIyLjEwLjIyIgogICBkYzpGb3JtYXQ9ImltYWdlL3BuZyIKICAgdGlmZjpPcmllbnRhdGlvbj0iMSIKICAgeG1wOkNyZWF0b3JUb29sPSJHSU1QIDIuMTAiPgogICA8aXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgIDxpcHRjRXh0OkxvY2F0aW9uU2hvd24+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvblNob3duPgogICA8aXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgIDxpcHRjRXh0OlJlZ2lzdHJ5SWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpSZWdpc3RyeUlkPgogICA8eG1wTU06SGlzdG9yeT4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAgc3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo0OTk0M2E4ZS1iNDg3LTQ2OGItOGZiYy1hMWUxNzI0MjU0OGMiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkdpbXAgMi4xMCAoV2luZG93cykiCiAgICAgIHN0RXZ0OndoZW49IjIwMjEtMTAtMDhUMTg6MzU6MzciLz4KICAgIDwvcmRmOlNlcT4KICAgPC94bXBNTTpIaXN0b3J5PgogICA8cGx1czpJbWFnZVN1cHBsaWVyPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VTdXBwbGllcj4KICAgPHBsdXM6SW1hZ2VDcmVhdG9yPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VDcmVhdG9yPgogICA8cGx1czpDb3B5cmlnaHRPd25lcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkNvcHlyaWdodE93bmVyPgogICA8cGx1czpMaWNlbnNvcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkxpY2Vuc29yPgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgIAo8P3hwYWNrZXQgZW5kPSJ3Ij8+OmUcHgAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+UKCBEjJe0Qer4AAAjVSURBVGje1ZlZbFxXGcf/3znn3tk83u24SVMnEVnUNKnDUqG0CIpQRUpCWV6Q+oaEyAMIgfJS8QB9oFQsL1GlUqGmggopigQoRSqIRmlAUaGlTdKk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`)