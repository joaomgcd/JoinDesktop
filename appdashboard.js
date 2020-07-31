import { ControlLogs } from "./log/controllog.js";
import { Logs, Log } from "./log/log.js";
import { EventBus } from "./v2/eventbus.js";
import { UtilDOM } from "./v2/utildom.js";
import './v2/extensions.js';
import { App,RequestLoadDevicesFromServer } from "./v2/app.js";
import {AppHelperSettings} from "./v2/settings/apphelpersettings.js"
import { ControlSettings } from "./v2/settings/controlsetting.js";
import { SettingEncryptionPassword, SettingTheme, SettingThemeAccentColor,SettingCompanionAppPortToReceive, SettingKeyboardShortcutLastCommand, SettingKeyboardShortcutShowWindow, SettingEventGhostNodeRedPort, SettingClipboardSync, SettingCustomActions, SettingUseNativeNotifications, SettingNotificationTimeout, SettingRequireEncryptionForCommandLine, SettingKeyboardShortcutSkipSong, SettingKeyboardShortcutPreviousSong, SettingKeyboardShortcutPlayPause } from "./v2/settings/setting.js";
import { AppGCMHandler } from "./v2/gcm/apphelpergcm.js";
import { ControlDialogInput, ControlDialogOk } from "./v2/dialog/controldialog.js";
import { AppContext } from "./v2/appcontext.js";
import { ControlTabs, Tab } from "./v2/tabs/controltabs.js";

class ResultNotificationAction{
    constructor(success){
        this.success = success;
    }
}
class AuthToken{
    constructor(authToken){
        this.authToken = authToken;
    }
}
export class CurrentGoogleUserChanged{
	constructor(googleUser){
		this.googleUser = googleUser;
	}
}
const currentUserKey = "currentUser";
class GoogleAccountDashboard{
    constructor(){
        EventBus.register(this);        
        window.api.receive("authToken", async data => {
            EventBus.post(new AuthToken(data));
        });   
    }
    get authToken(){        
        return (async () => {
            window.api.send("authToken");
            const result = await EventBus.waitFor(AuthToken,5000);
            const token = result.authToken;
            await this.refreshCurrentUserIfNeeded(token);
            return token;
        })();
    }
    get isSignedIn(){
        return (async()=>{
            if(!AppContext.context.getMyDeviceId()) return false;
            
            const authToken = await this.authToken;
            return authToken ? true : false;
        })();
    }
    static async resetUser(){
        AppContext.context.localStorage.delete(currentUserKey);
    }
    async refreshCurrentUserIfNeeded(token){
        if(this.currentUser) return this.currentUser;


        this.currentUser = AppContext.context.localStorage.getObject(currentUserKey);
        if(this.currentUser && this.currentUser.email) return this.currentUser;

        const user = await UtilWeb.get({url:"https://www.googleapis.com/oauth2/v1/userinfo?alt=json",token})
        if(!user.email) return null;
        
        this.currentUser = user;
        AppContext.context.localStorage.setObject(currentUserKey,this.currentUser);
        return this.currentUser;
    }
    async getCurrentUser(){
        const token = await this.authToken;
        const result = this.currentUser;   
        if(!result) return null;

        result.token = token;
        result.imageUrl = result.picture;
        EventBus.postSticky(new CurrentGoogleUserChanged(result));
        return result;
    }
    async signOut(){
        await GoogleAccountDashboard.signIn(true);
    }
    static async signIn(signOutFirst){        
        if(signOutFirst){            
            await GoogleAccountDashboard.resetUser();
            await ControlDialogOk.showAndWait({title:"Signing Out",text:"Please sign in to another account on the Join website."});
        }
        const setting = new SettingCompanionAppPortToReceive();
        let value = await setting.value;
        if(!value){
            value = 9876;
            setting.value = value;
        }
        await ServerSetting.set(SettingCompanionAppPortToReceive.id,value);
        await UtilDOM.createElement({
            type:"div",
            id:"signinviaapp",
            content: `Please wait while Join signs you in...`,
            parent: this.contentElement
        });
        if(!signOutFirst){
            await ControlDialogOk.showAndWait({title:"Not Signed In",text:"Join will now sign you in via the Join website..."});
        }
        let url = `${self.joinServer}?settings&connectoport=${value}`;
        if(signOutFirst){
            url += "&signOutCompanion=1";
        }
        ServerCommands.openPage(url);
    }
}
class FCMClientDashboard{
    getToken(){
        return null;
    }    
	async showNotification(notification,gcm){
        //delete notification.data;
        // delete notification.icon;
        // delete notification.badge;
        // Object.assign(notification.data,await gcm.gcmRaw);
        const gcmRaw = await gcm.gcmRaw;
        const {SettingUseNativeNotifications} = await import("./v2/settings/setting.js");
        notification.native = await new SettingUseNativeNotifications().value;
        
        const {SettingNotificationTimeout} = await import("./v2/settings/setting.js");
        notification.timeout = await new SettingNotificationTimeout().value;
        if(notification.timeout){
            notification.timeout = notification.timeout * 1000;
            notification.requireInteraction = false;
        }
		return window.api.send("notification",{notification,gcmRaw});
	}
}
class ServerCommands{
    static async openPage(url){
        window.api.send("openurl",url);
    }
}
class ServerSetting{
    static async set(key,value){
        await window.api.send("setting",{key,value})
    }
}
export class ServerEventBus{
    static async post(object){
        try{
            await window.api.send('eventbus', {data:object,className:object.constructor.name});
        }catch{
            let data = {data:object,className:object.constructor.name};
            data = JSON.stringify(data);
            data = JSON.parse(data);
            await window.api.send('eventbus', data);
        }
    }
    static async postAndWaitForResponse(object,repsonseClzz,timeout){
        const responsePromise = EventBus.waitFor(repsonseClzz,timeout);
        ServerEventBus.post(object);
        return responsePromise;
    }
}
export class AppHelperSettingsDashboard extends AppHelperSettings{
    constructor(args = {app}){
        super(args);
        this.app = args.app;
    }
    get settingsList(){
        return (async () => {
            const devices = await this.app.devicesFromDb;
            return new ControlTabs([    
                new Tab({title:"Theme",controlContent:new ControlSettings([
                    new SettingTheme(),
                    new SettingThemeAccentColor(),
                ])}),      
                new Tab({title:"Shortcuts",controlContent:new ControlSettings([
                    new SettingKeyboardShortcutLastCommand(),
                    new SettingKeyboardShortcutShowWindow(),
                    new SettingKeyboardShortcutSkipSong(),
                    new SettingKeyboardShortcutPreviousSong(),
                    new SettingKeyboardShortcutPlayPause(),
                ])}),   
                new Tab({title:"Actions",controlContent:new ControlSettings([
                    new SettingCustomActions({devices}),
                ])}),   
                new Tab({title:"Clipboard Sync",controlContent:new ControlSettings([
                    new SettingClipboardSync({devices})
                ])}),
                new Tab({title:"Automation",controlContent:new ControlSettings([
                    new SettingEventGhostNodeRedPort(),
                ])}),
                new Tab({title:"General",controlContent:new ControlSettings([
                    new SettingCompanionAppPortToReceive(),
                    new SettingEncryptionPassword(),
                    new SettingRequireEncryptionForCommandLine(),
                    new SettingUseNativeNotifications(),
                    new SettingNotificationTimeout(),
                ])}),
            ]);
            // return new ControlSettings([
            //     new SettingCompanionAppPortToReceive(),
            //     new SettingEventGhostNodeRedPort(),
            //     new SettingEncryptionPassword(),
            //     new SettingTheme(),
            //     new SettingThemeAccentColor(),
            //     new SettingKeyboardShortcutLastCommand(),
            //     new SettingKeyboardShortcutShowWindow(),
            //     new SettingClipboardSync({devices:(await this.app.devicesFromDb)})
            // ]);
        })();
    }
    async load(){
        await super.load();
        this.setOpenWebAppListener();
    }
    setOpenWebAppListener(){
        document.querySelector("#linkopenwebapp").onclick = () => ServerCommands.openPage(`${self.joinServer}?settings`);
    }
    async onSettingSaved(settingSaved){
        const setting = settingSaved.setting;
        let value = settingSaved.value;
        if(!setting) return;

        if(setting.id == SettingCompanionAppPortToReceive.id && value){
            value = parseInt(value);
            await ServerSetting.set(SettingCompanionAppPortToReceive.id,value);
        }
        await super.onSettingSaved(settingSaved);
        this.setOpenWebAppListener();
    }

}
class RequestRunCommandLineCommand{
    constructor(args = {command,args}){
        Object.assign(this,args);
    }
}
class ResponseRunCommandLineCommand{}
export class AppGCMHandlerDashboard extends AppGCMHandler{    
    async handleGCMPush({gcm, push, notification}){
        if(push.clipboard){
            notification.text = push.clipboard;
        }
        if(push.commandLine){
            const needsToBeEncrypted =  await new SettingRequireEncryptionForCommandLine().value;
            if(needsToBeEncrypted && !gcm.wasEncrypted){
                this.app.showToast({text:"Didn't run command line command. Not encrypted.",isError:true});
                return;
            }
            const {CustomAction} = await import("./v2/customactions/customactions.js")
            const {command,args} = CustomAction.getCommandToExecuteFromCommandText(push.text);
            const response = await EventBus.postAndWaitForResponse(new RequestRunCommandLineCommand({command,args}),ResponseRunCommandLineCommand,10000);
            if(push.commandName){
                notification.text = push.commandName;
            }
            if(push.commandResponse){
                const sender = await this.app.getDevice(push.senderId);
                if(sender){
                    const command = `${push.commandResponse}=:=${response.out.trim()}`
                    console.log("Sending command response",command,sender)
                    await sender.sendPush({text:command});
                }
            }
            return false;
        }
        return true;
    }
    
}
class RequestToggleDevOptions{}
class RequestClipboard{}
class RequestSetClipboard{
    constructor(text){
        this.text = text;
    }
}
class ResponseClipboard{}
class RequestListenForShortcuts{
    constructor(shortcuts){
        this.shortcuts = shortcuts;
    }
}
class RequestFocusWindow{}
class RequestAppVersion{}
class ResponseAppVersion{}
class RequestDownloadAndOpenFile{
    constructor(url){
        this.url = url;
    }
}
class RequestInstallLatestUpdate{}
class Changes{
    static async getAll(){
        const info = await UtilWeb.get("changes.json");
        return info.changes;
    }
    static async get(version){
        const changes = await Changes.getAll();
        const change = changes.find(change => change.version == version);
        if(!change) return null;
        return change;
    }
}
export class AppDashboard extends App{
    constructor(contentElement){
        super(contentElement);
    }
    async load(){
        AppContext.context.allowUnsecureContent = true;
        window.oncontextmenu = () => ServerEventBus.post(new RequestToggleDevOptions())
        // AppGCMHandler.handlePushUrl = (push)=> {
        //     const url = push.url;
        //     if(!url) return;

        //     console.log("Ignoring url because it was handled in server")
        // }
        Util.openWindow = url => {
            ServerCommands.openPage(url);
            return true;
        }
        Util.getClipboardText = async () => {
            const result = EventBus.waitFor(ResponseClipboard,3000);
            ServerEventBus.post(new RequestClipboard());
            return result.then(response=>response.text);
        }
        Util.setClipboardText = async text => {
            await ServerEventBus.post(new RequestSetClipboard(text));
        }
        self["prompt"] = async (title,initialText) => await ControlDialogInput.showAndWait({title,initialText: (initialText ? initialText : ""),placeholder:""});
        self["alert"] = async text => await ControlDialogOk.showAndWait({text,title:"Join"});
        window.api.receive("log", async data => {
            //this.controlLogs.addLog(new Log(data));
        });   
        window.api.receive("sendpush", async push => {
            const device = await this.getDevice(push.deviceId);
            await device.sendPush(push);
        });
        window.api.receive("eventbus", async ({data,className}) => {
           await EventBus.post(data,className);
        });
        window.api.receive("usersignedin", async () => {
            location.reload();
        });
        UtilDOM.addScriptFile("./v2/utilweb.js");
        UtilDOM.addScriptFile("./v2/db.js");
        UtilDOM.addScriptFile("./v2/google/drive/googledrive.js");
        await this.loadAppContext();
        const query = Util.getQueryObject();
        if(!query.notificationpopup){
            await super.load();
            await this.showNewVersionInfo();
            await this.uploadIpAddressesFile();
        }else{
            await this.loadEssentials();

            this.onRequestReplyMessage = null;
            const {AppDashboardNotifications} = await import("./appdashboardhelpernotifications.js");
            const helperNotifications = new AppDashboardNotifications(this);
            await helperNotifications.load();
        }
    }
    applyTheme(theme,accent){
        super.applyTheme(theme,accent);
        EventBus.post({},"ThemeApplied");
    }
    async uploadIpAddressesFile(){
        const deviceId = this.myDeviceId;
        if(!deviceId) return;

        const appInfo = await this.appInfo;
        const serverAddress = appInfo.serverAddress;
        if(!serverAddress) return;

        const googleDrive = new GoogleDrive(async ()=>await this.getAuthToken());
        const result = await googleDrive.uploadContent({
            ignoreFolderForGetFile: true,
            //getParents:true,
            fileName: `serveraddresses=:=${deviceId}`,
            content: {serverAddress,senderId:deviceId},
            folderName: `${GoogleDrive.getBaseFolderForMyDevice()}/Settings Files`,
            overwrite: true
        });
        console.log(result);
    }
    async showNewVersionInfo(){
        const appInfo = await this.appInfo;
        const key = "lastupdatelogshown";
        const lastVersionShown = parseFloat(AppContext.context.localStorage.get(key))
        if(lastVersionShown && lastVersionShown >= parseFloat(appInfo.version)) return;

        const info = await Changes.get(appInfo.version);
        if(!info) return;

        let liTag = `<li style="padding: 8px;">`
        let text = info.log.join(`</li>${liTag}`);
        text = `<ul>${liTag}${text}</li></ul>`;
        const title = `Changes for version ${appInfo.version}`;
        const timeout = 999999999;
        try{
            if(info.demo){
                const buttons = ["OK","Demo"]
                const buttonsDisplayFunc = button=>button;
                const button = await ControlDialogOk.showAndWait({title,text,timeout,buttons,buttonsDisplayFunc});
                if(button.button != "Demo") return;
    
                Util.openWindow(info.demo);
            }else{
                await ControlDialogOk.showAndWait({title,text,timeout});
            }
        }finally{            
            AppContext.context.localStorage.set(key,appInfo.version);
        }
    }
    get newGcmHandlerInstance(){
        return new AppGCMHandlerDashboard(this);
    }
    get appInfo(){
        return ServerEventBus.postAndWaitForResponse(new RequestAppVersion(),ResponseAppVersion,5000);
    }
    async onUpdateAvailable(request){
        const result = await ControlDialogOk.showAndWaitOkCancel({title:"New Version Available",text:`Version ${request.version} of the app is available. Download now?`})
        if(!result.isOk) return;

        await ControlDialogOk.showAndWait({title:"Downloading now!",text:`Ok will now download the new version!<br/><br/> Will automatically update the app once downloaded.`,timeout:30000})
        await ServerEventBus.post(new RequestInstallLatestUpdate());
    }
    async loadShortcuts(){

        const {DBKeyboardShortcut} = await import("./v2/keyboard/keyboardshortcut.js");
        const dbShortcut = new DBKeyboardShortcut(this.db);
        const configured = await dbShortcut.getAll();
        ServerEventBus.post(new RequestListenForShortcuts(configured.map(shortcutAndCommand=>shortcutAndCommand.shortcut)));
    }
    async onRequestExecuteGCMOnPage({gcmRaw}){
        await GCMBase.executeGcmFromJson(gcmRaw.type,gcmRaw.json);
    }
    async onRequestHandleNotificationClickGCMOnPage({gcmRaw,action}){
        const gcm = await GCMBase.getGCMFromJson(gcmRaw.type,gcmRaw.json);
        if(!gcm || !gcm.handleNotificationClick) return;

        await gcm.handleNotificationClick(action);
    }
    async onShortcutPressed(shortcutPressed){         
        try{
            let shortcut = shortcutPressed.shortcut;
            if(!shortcut) return;

            const command = await this.getKeyboardShortcutCommand(shortcut);
            if(!command) return;

            if(!command.needsFocus) return;

            ServerEventBus.post(new RequestFocusWindow());
        }finally{
            await super.onShortcutPressed(shortcutPressed);
        }
    }
    async onRequestReplyMessageFromServer(request){
        EventBus.post(request,"RequestReplyMessage");
    }
    async onRequestNotificationAction(request){
        let success = false;
        try{
            const resultPromise = EventBus.waitFor(ResultNotificationAction,3000);
            // request = JSON.parse(JSON.stringify(request))
            ServerEventBus.post(request);
            const result = await resultPromise;
            success = result.success;
        }catch{}
        if(success) return;

        await super.onRequestNotificationAction(request);
    }
    async onNotificationsCleared(notificationsCleared){
        await ServerEventBus.post(notificationsCleared);
    }
    async onGCMNotificationClear(gcm){
        await ServerEventBus.post(gcm);
    }
    onRequestStoredNotifications(request){
        ServerEventBus.post(request);
    }
    showCloseButton(){
        return true;
    }
    redirectToHttpsIfNeeded(){}
    
    get hideBookmarklets(){
        return true;
    }
    async onCompanionHostConnected(info){
        this.myDeviceId = info.companionBrowserId;
    }
    async onWebSocketGCM(webSocketGCM){
        const gcmRaw = webSocketGCM.gcmRaw;
        //await GCMBase.executeGcmFromJson(gcmRaw.type,gcmRaw.json);
         window.api.send("gcm",webSocketGCM.gcmRaw);
    }
    async onDevices(devices){
        window.api.send("devices",devices);
    }
    async onCloseAppClicked(closeAppClicked){
        ServerEventBus.post(closeAppClicked)
    }
    async onMinimizeAppClicked(clicked){
        ServerEventBus.post(clicked)
    }
    async onMinimizeToTaskBarAppClicked(clicked){
        ServerEventBus.post(clicked)
    }
    async loadWhenNotSignedIn(){
        GoogleAccountDashboard.signIn(false);
    }
    async loadApiLoader(){
        const googleAccount = await this.googleAccount;
        console.log("Loaded user",await googleAccount.getCurrentUser())
        return true;
    }
    get googleAccount(){
        if(this._googleAccount) return this._googleAccount;

        return (async()=>{ 
            this._googleAccount = new GoogleAccountDashboard();
            return this._googleAccount;
        })();
       
    }
    async getAuthToken(){
        const googleAccount = await this.googleAccount;
        return await googleAccount.authToken;
    }
    async loadFcmClient(){
        if(this.fcmClient) return this.fcmClient;

        window.api.receive("gcm", async data => {
            console.log("Received gcm",data);
            await GCMBase.executeGcmFromJson(data.type,JSON.stringify(data));
        });
        this.fcmClient = new FCMClientDashboard();
        /*if ('serviceWorker' in navigator) {
            try{
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }catch(error){
                console.log('ServiceWorker registration failed: ', error);
            }
        }*/
        return this.fcmClient;
    }
    async onGCMAutoClipboard(gcm){
        gcm.text = await Encryption.decrypt(gcm.text);
        ServerEventBus.post(gcm);
    }
    async onClipboardChanged(clipboardChanged){
        const setting = new SettingClipboardSync({devices:(await this.devicesFromDb)});
        const deviceIdsToSendTo = await setting.value;
        if(deviceIdsToSendTo.length == 0) return;

        const { GCMAutoClipboard } = await import("./v2/gcm/gcmapp.js");
        const gcm = new GCMAutoClipboard();
        gcm.text = await Encryption.encrypt(clipboardChanged.text);
        const devices = await this.getDevices(deviceIdsToSendTo);
        console.log("Sending auto clipboard", gcm, devices);
        await devices.send(gcm);
    }
    async onRequestRunCommandLineCommand(request){
        await ServerEventBus.post(request);
    }
    get isBrowserRegistered(){
        return true;
    }
    async registerBrowser({force}){            
        await EventBus.post(new RequestLoadDevicesFromServer());
    }
    
    get allowUnsecureContent(){
        return true;
    }
    
    get helperSettingsFile(){
        return '../appdashboard.js';
    }
    get helperSettingsClassName(){
        return 'AppHelperSettingsDashboard';
    }
    // async load(){
    //     EventBus.register(this);
    //     this.contentElement.innerHTML = "";

    //     this.controlTop = new ControlTop();
    //     await this.addElement(this.controlTop);  
    //     this.controlTop.appName = "Join Companion App";       
    //     this.controlTop.hideHomeImage();
    //     this.controlTop.loading = false;
    //     this.controlTop.shouldAlwaysShowImageRefresh = false;

    //     this.controlLogs = new ControlLogs(new Logs());
    //     await this.addElement(this.controlLogs);
    //     window.api.receive("gcm", async data => {
    //         await GCMBase.executeGcmFromJson(data.type,JSON.stringify(data));
    //     });
    //     window.api.receive("log", async data => {
    //         this.controlLogs.addLog(new Log(data));
    //     });
    //     window.api.receive("authToken", async data => {
    //         EventBus.post(new AuthToken(data));
    //     });
    //     await UtilDOM.addStyleFromFile("./v2/global.css");
    //     console.log("App loaded");
    //     console.log("Auth Token", await this.getAuthToken());    
    // }
    

    // async addElement(control,parent=null){
    //     const render = await control.render();
        
    //     if(!parent){
    //         parent = this.contentElement;
    //     }
    //     parent.appendChild(render);
    // }
    // async onGCMPush(gcm){
    //     console.log("Received push",gcm);        
    //     const notificationInfo = gcm.notificationInfo;
    //     this.controlLogs.addLog(new Log(notificationInfo));
    // }
}