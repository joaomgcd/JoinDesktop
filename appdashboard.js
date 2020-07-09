import { ControlLogs } from "./log/controllog.js";
import { Logs, Log } from "./log/log.js";
import { EventBus } from "./v2/eventbus.js";
import { UtilDOM } from "./v2/utildom.js";
import './v2/extensions.js';
import { App,RequestLoadDevicesFromServer } from "./v2/app.js";
import {AppHelperSettings} from "./v2/settings/apphelpersettings.js"
import { ControlSettings } from "./v2/settings/controlsetting.js";
import { SettingEncryptionPassword, SettingTheme, SettingThemeAccentColor,SettingCompanionAppPortToReceive } from "./v2/settings/setting.js";
import { AppGCMHandler } from "./v2/gcm/apphelpergcm.js";
import { ControlDialogInput, ControlDialogOk } from "./v2/dialog/controldialog.js";
import { AppContext } from "./v2/appcontext.js";

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
		return window.api.send("notification",notification);
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
class ServerEventBus{
    static async post(object){
        await window.api.send('eventbus', {data:object,className:object.constructor.name});
    }
}
export class AppHelperSettingsDashboard extends AppHelperSettings{
    constructor(args = {app}){
        super(args);
    }
    get settingsList(){
        return  new ControlSettings([
            new SettingCompanionAppPortToReceive(),
            new SettingEncryptionPassword(),
            new SettingTheme(),
            new SettingThemeAccentColor()
        ]);
    }
    async load(){
        await super.load();
        this.setOpenWebAppListener();
    }
    setOpenWebAppListener(){
        document.querySelector("#linkopenwebapp").onclick = () => ServerCommands.openPage("https://joinjoaomgcd.appspot.com/?settings");
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
class RequestToggleDevOptions{}
export class AppDashboard extends App{
    constructor(contentElement){
        super(contentElement);
    }
    async load(){
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
        await super.load();
    }
    showCloseButton(){
        return true;
    }
    redirectToHttpsIfNeeded(){}
    
    get hideSendTabCommand(){
        return true;
    }
    async onCompanionHostConnected(info){
        this.myDeviceId = info.companionBrowserId;
    }
    async onWebSocketGCM(webSocketGCM){
        const gcmRaw = webSocketGCM.gcmRaw;
        await GCMBase.executeGcmFromJson(gcmRaw.type,gcmRaw.json);
        // window.api.send("gcm",webSocketGCM.gcmRaw);
    }
    async onDevices(devices){
        window.api.send("devices",devices);
    }
    async onCloseAppClicked(closeAppClicked){
        ServerEventBus.post(closeAppClicked)
    }
    async loadWhenNotSignedIn(){
        GoogleAccountDashboard.signIn(false);
    }
    async loadApiLoader(){
        const googleAccount = await this.googleAccount;
        console.log("Loaded user",await googleAccount.getCurrentUser())
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
        console.log("Sending auto clipboard", clipboardChanged.text);
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