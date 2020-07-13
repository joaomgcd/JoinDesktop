
import { EventBus } from './eventbus.js';
import { ApiServer } from './api/apiserver.js';
//import { ControlTop } from './top/controltop.js';
//import { ControlDevices } from './device/controldevice.js';
import { UtilDOM } from './utildom.js';
//import { ControlCommands } from './command/controlcommand.js';
//import { ControlDebug } from './debug/controldebug.js';
//import { Toast } from './toast/toast.js';
//import { AppContext } from './appcontext.js';

//import { GoogleAccount } from './google/account/googleaccount.js';
//import { ControlGoogleAccount } from './google/account/controlgoogleaccount.js';
import './extensions.js';
//import { DBDevices } from './device/dbdevice.js';
import { ControlMenu } from './menu/controlmenu.js';
import { Menu,MenuEntry } from './menu/menu.js';
import { ControlTop } from './top/controltop.js';
import { ControlDebug } from './debug/controldebug.js';
import { SettingTheme, SettingThemeAccentColor, SettingCompanionAppPortToConnect } from './settings/setting.js';

const CLIENT_ID  = "596310809542-c2bg952rtmf05el5kouqlcf0ajqnfpdl.apps.googleusercontent.com";
const settingKeySignOutCompanion = "signOutCompanion";
const settingKeySetupCompanion = "setupCompanion";
let ControlDevices = null;
let ControlCommands = null;
let ControlGoogleAccount = null;
let AppContext = null;
let DBDevices = null;
const importDbDevices = async () => {    
    DBDevices = (await import('./device/dbdevice.js')).DBDevices
}
export class App{
    constructor(rootElement){
        this.rootElement = rootElement;
        this.rootElement.innerHTML = "";
    }
    get contentElement(){
        return this._contentElement;
    }
    redirectToHttpsIfNeeded(){
        Util.redirectToHttpsIfNeeded();
    }
    async load(){
        this.redirectToHttpsIfNeeded();
        this.applyTheme();
        if(!Util.areCookiesEnabled){
            await alert("Cookies are disabled. Please enable them and refresh the page to continue.");
            return;
        }
        const queryObject = Util.getQueryObject();
        UtilDOM.addScriptFile("./v2/encryption/encryption.js");
        UtilDOM.setCssVhVariableAndListenToWindowChanges();
        self.getAuthTokenPromise = async () => await this.getAuthToken();
        EventBus.register(this);  
        
		if(window.location.href.indexOf("join") >= 0 && window.location.protocol == "http:" ){
            window.location = window.location.href.replace("http:","https:");
            return;
        }       
        await UtilDOM.addStyleFromFile("./v2/global.css");
        // const rootRule = document.styleSheets[0].cssRules[0];
        // const rootStyle = rootRule.style;
        // const lightColor = UtilDOM.increaseBrightnessRule(rootStyle,"--theme-accent-color",50);
        // const darkColor = UtilDOM.increaseBrightnessRule(rootStyle,"--theme-accent-color",-20);
        // UtilDOM.setCssVariable("theme-accent-color-light",lightColor);
        // UtilDOM.setCssVariable("theme-accent-color-dark",darkColor);
        UtilDOM.addStyle(`@import url('https://fonts.googleapis.com/css?family=Roboto');`); 
            


        this.controlDebug = new ControlDebug();
        await this.addElement(this.controlDebug,this.rootElement); 
        
        this.controlTop = new ControlTop();
        await this.addElement(this.controlTop,this.rootElement);
        this.controlTop.loading = true;
        if(this.showCloseButton()){            
            this.controlTop.showCloseAppButton();
            this.controlTop.showMinimizeAppButton();
        }

        this._contentElement = document.createElement("div");
        this._contentElement.id = "basecontent";
        this.rootElement.appendChild(this._contentElement);


        await this.loadApiLoader();

        if(queryObject.connectoport){
            await this.loadAppContext();
            AppContext.context.localStorage.set(settingKeySetupCompanion,queryObject.connectoport);
        }
        try{
            const googleAccount = await this.googleAccount;
            if(queryObject.signOutCompanion){
                await this.loadAppContext();
                AppContext.context.localStorage.set(settingKeySignOutCompanion,true);
                Util.changeUrl("/");
                await googleAccount.signOut();
                return;
            }
            const isSignedIn = await googleAccount.isSignedIn;
            if(!isSignedIn){
                await this.loadWhenNotSignedIn();
                return;
            }

            await this.loadWhenSignedIn();
        }finally{            
            // this.controlTop.loading = false;
            // this.controlTop.setMessage("Done loading!");
            // this.controlTop.hideMessage();
            
        }
    }
    showCloseButton(){
        return false;
    }
    async loadWhenNotSignedIn(){   
        this.controlTop.shouldAlwaysShowImageRefresh = false;
        this.controlTop.loading = false;
        this.controlTop.hideNavigation();
        ControlGoogleAccount = (await import('./google/account/controlgoogleaccount.js')).ControlGoogleAccount
        const controlGoogleAccount = new ControlGoogleAccount();
        await this.addElement(controlGoogleAccount);
        const element = controlGoogleAccount.signInButtonElement;
        const onSuccess = this.loadWhenSignedIn;
        (await this.googleAccount).attachSignInClickHandler({element,onSuccess})      
        this.controlTop.loading = false;
    }
    async loadApiLoader(){
        const {ApiLoader} = await import('./apiloader.js');
        this.apiLoader = new ApiLoader(CLIENT_ID);        
        this.apiLoader.addApi({"name":'oauth2',"version":'v2' });
        await this.apiLoader.load(); 
    }
    get allowUnsecureContent(){
        return false;
    }
    async loadAppContext(){
        AppContext = (await import('./appcontext.js')).AppContext
    }
    async onRightImageClicked(){
        await this.switchAccounts();
    }
    async loadWhenSignedIn(){                

        await this.loadAppContext();
        this.controlTop.rightImage = await this.userImage;
        this.menuEntryDevices = new MenuEntry({
            id:"devices",
            label:"Devices",
            js:'./device/apphelperdevices.js',
            clazz:"AppHelperDevices",
            load: async ()=>{
                return {app:this,allowUnsecureContent:this.allowUnsecureContent};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0V0z"></path><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"></path></svg>`
        });
        this.menuEntrySms = new MenuEntry({
            id:"sms",
            label:"SMS",
            js:'./sms/apphelpersms.js',
            clazz:"AppHelperSMS",
            load: async (deviceId=null)=>{
                var device = await this.getDevice(deviceId);
                if(!device){
                    device = await this.smsDevice;
                }else{
                    this.smsDevice = device;
                }
                if(!device){
                    await alert("You don't have a device that can send SMS messages.");
                    await this.selectMenuEntry({menuEntry:this.menuEntryDevices});
                    return;
                }
                return {app:this,device};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0V0z"></path><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7zm8 0h2v2h-2zm-4 0h2v2h-2z"></path></svg>`
        });
        this.menuEntryNotifications = new MenuEntry({
            id:"notifications",
            label:"Notifications",
            js:'./notification/apphelpernotifications.js',
            clazz:"AppHelperNotifications", 
            load: async (deviceId=null)=>{
                var device = await this.getDevice(deviceId);
                if(!device){
                    device = await this.notificationsDevice;
                }else{
                    this.notificationsDevice = device;
                }
                if(!device){
                    await alert("You don't have a device that can sync notifications.");
                    await this.selectMenuEntry({menuEntry:this.menuEntryDevices});
                    return;
                }
                return {app:this,device};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0V0z"></path><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"></path></svg>`
        })
        this.menuEntryMedia = new MenuEntry({
            id:"media",
            label:"Media",
            js:'./media/apphelpermedia.js',
            clazz:"AppHelperMedia", 
            load: async ()=>{
                return {app:this};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17S7.79 21 10 21 14 19.21 14 17V7H18V3H12Z" /></svg>`
        })
        this.menuEntryFiles = new MenuEntry({
            id:"files",
            label:"Files",
            js:'./files/apphelperfiles.js',
            clazz:"AppHelperFiles", 
            load: async (deviceId=null)=>{
                var device = await this.getDevice(deviceId);
                if(!device){
                    device = await this.notificationsDevice;
                }else{
                    this.notificationsDevice = device;
                }
                if(!device){
                    await alert("You don't have a device that you can view files on.");
                    await this.selectMenuEntry({menuEntry:this.menuEntryDevices});
                    return;
                }
                return {app:this,device};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M16 0H8C6.9 0 6 .9 6 2V18C6 19.1 6.9 20 8 20H20C21.1 20 22 19.1 22 18V6L16 0M20 18H8V2H15V7H20V18M4 4V22H20V24H4C2.9 24 2 23.1 2 22V4H4Z"/></svg>`
        })
        this.menuEntryPushHistory = new MenuEntry({
            id:"pushhistory",
            label:"Push History",
            js:'./pushhistory/apphelperpushhistory.js',
            clazz:"AppHelperPushHistory", 
            load: async (deviceId=null)=>{
                var device = await this.getDevice(deviceId);
                if(!device){
                    device = await this.pushHistoryDevice;
                }else{
                    this.pushHistoryDevice = device;
                }
                return {app:this,device};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3" /></svg>`
        })
        this.menuEntrySettings = new MenuEntry({
            id:"settings",
            label:"Settings",
            js:this.helperSettingsFile,
            clazz:this.helperSettingsClassName, 
            load: async (d)=>{
                return {app:this};
            },
            icon:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/></svg>`
        })
        const menu = new Menu([
            this.menuEntryDevices,
            this.menuEntrySms,
            this.menuEntryFiles,
            this.menuEntryNotifications,
            this.menuEntryMedia,
            this.menuEntryPushHistory,
            this.menuEntrySettings
        ]);
        this.controlMenu = new ControlMenu(menu);
        await this.addElement(this.controlMenu,this.rootElement);
        await this.controlMenu.loadUserInfo();
        await this.controlTop.showMenu(true);

        var args = await this.chooseHelperFromQueryParameters(menu);
        if(!args){
            args = {menuEntry:this.menuEntryDevices};
        }
        await this.selectMenuEntry(args);
        await this.controlMenu.renderTabsTo(this.controlTop.tabsElement);

        await this.loadJoinApis(); 
        //await this.loadDevicesFromServer();
        await this.gcmHandler; 
        await this.loadFcmClient();
        await this.registerBrowser({force:false});    

        const portFromConnectionRequest = AppContext.context.localStorage.get(settingKeySetupCompanion);
        if(AppContext.context.localStorage.get(settingKeySignOutCompanion) || portFromConnectionRequest){
            AppContext.context.localStorage.delete(settingKeySignOutCompanion);
            AppContext.context.localStorage.delete(settingKeySetupCompanion);
            let port = portFromConnectionRequest;
            if(!port){
                const setting = new SettingCompanionAppPortToConnect();
                port = await setting.value;
            }
            if(port){
                const args = await this.menuEntrySettings.load();
                args.connectoport = port;
                await this.selectMenuEntry({menuEntry:this.menuEntrySettings,args});
                return;
            }
        } 
  
    }
    get hideSendTabCommand(){
        return false;
    }
    get gcmHandler(){
        if(this._gcmHandler) return this._gcmHandler;

        return (async()=>{
            const {AppGCMHandler} = await import('./gcm/apphelpergcm.js');
            this._gcmHandler = new AppGCMHandler(this);
            return this._gcmHandler;
        })();
    }
    get helperSettingsFile(){
        return './settings/apphelpersettings.js';
    }
    get helperSettingsClassName(){
        return 'AppHelperSettings';
    }
    async chooseHelperFromQueryParameters(menu){
        for(const menuEntry of menu){            
            const load = menuEntry.load;
            if(!load) continue;

            const queryParam = Util.getQueryParameterValue(menuEntry.id);
            if(queryParam == null) continue;

            const args = await load(queryParam);
            if(!args) continue;

            return {menuEntry,args};
        }
        return null;
    }
    onRequestOpenMenu(){
        if(!this.controlMenu) return;

        this.controlMenu.open();
    }
    async onMenuEntry(menuEntry){
        const load = menuEntry.load;
        if(!load) return;

        const args = menuEntry.args;
        this.selectMenuEntry({menuEntry,args});
        
    }
    async selectMenuEntry({menuEntry,args = null}){
        if(!args){
            args = await menuEntry.load();
        }
        if(!args) return;

        if(this.helper){
            await this.helper.unload();
        }
        this.contentElement.innerHTML = "";
        Object.assign(args,Util.getQueryObject());
        this.helper = await Util.importAndInstantiate(menuEntry.js,menuEntry.clazz,args);
        this.controlMenu.selectedEntry = menuEntry;
        await this.helper.updateUrl();
        UtilDOM.addOrRemoveClass(document.body, this.helper.isPanel, "panel");
        await this.helper.load();
    }  
    set smsDevice(device){
        AppContext.context.localStorage.set("smsDevice",device.deviceId);
    }
    get smsDevice(){
        return (async ()=>{
            const deviceId = AppContext.context.localStorage.get("smsDevice");
            var device = await this.getDevice(deviceId);
            if(!device){
                const devices = await this.devicesFromDb;
                device = devices.find(device=>device.canReceiveSms());
            }
            return device;
        })();
    }
    set filesDevice(device){
        AppContext.context.localStorage.set("filesDevice",device.deviceId);
    }
    get filesDevice(){
        return (async ()=>{
            const deviceId = AppContext.context.localStorage.get("filesDevice");
            var device = await this.getDevice(deviceId);
            if(!device){
                const devices = await this.devicesFromDb;
                device = devices.find(device=>device.canBrowseFiles());
            }
            return device;
        })();
    }
    set notificationsDevice(device){
        AppContext.context.localStorage.set("notificationsDevice",device.deviceId);
    }
    get notificationsDevice(){
        return (async ()=>{
            const deviceId = AppContext.context.localStorage.get("notificationsDevice");
            var device = await this.getDevice(deviceId);
            if(!device){
                const devices = await this.devicesFromDb;
                device = devices.find(device=>device.canSendNotifications());
            }
            return device;
        })();
    }
    set pushHistoryDevice(device){
        AppContext.context.localStorage.set("pushHistoryDevice",device.deviceId);
    }
    get pushHistoryDevice(){
        return (async ()=>{
            const deviceId = AppContext.context.localStorage.get("pushHistoryDevice");
            var device = await this.getDevice(deviceId);
            if(!device){
                const devices = await this.devicesFromDb;
                device = devices.find(device=>device.canShowPushHistory());
            }
            return device;
        })();
    }
    store(key,value){
        AppContext.context.localStorage.set(key,value);
    }
    restoreString(key){
        return AppContext.context.localStorage.get(key);
    }
    storeObject(key,value){
        AppContext.context.localStorage.setObject(key,value);
    }
    restoreObject(key){
        return AppContext.context.localStorage.getObject(key);
    }
    restoreBoolean(key){
        return AppContext.context.localStorage.getBoolean(key);
    }
    get configuredKeyboardShortcutKeys(){
        return [{
            key: " ",
            action: async (appHelperMedia,mediaInfo) => await appHelperMedia.togglePlay(mediaInfo)
        }];
    }
    async addElement(control,parent=null){
        const render = await control.render();
        
        if(!parent){
            parent = this.contentElement;
        }
        parent.appendChild(render);
    }
    get googleAccount(){
        if(this._googleAccount) return this._googleAccount;

        return (async()=>{ 
            const GoogleAccount = (await import('./google/account/googleaccount.js')).GoogleAccount
            const googleAccount = new GoogleAccount({clientId:CLIENT_ID});
            await googleAccount.load();
            this._googleAccount = googleAccount;
            return googleAccount;
        })();
       
    }
    async loadJoinApis(){ 
        // if(gapi.client.registration) return;

        // const apisToLoad = [
        //     /*{"name":'messaging',"version":'v1',"setRoot":true},
        //     {"name":'registration',"version":'v1',"setRoot":true},
        //     {"name":'authorization',"version":'v1',"setRoot":true},*/
        //     {"name":'drive',"version":'v3'}
        // ];
        // await this.apiLoader.loadApis(apisToLoad);
    }
    
    async loadFcmClient(){
        if(this._fcmClient) return this._fcmClient;

        return new Promise(resolve=>{
            this.fcmClient = new FCMClientImplementation();
            
            this.fcmClient.initPage(
                async token => {
                    console.log("Got token!",token);
                    this._fcmClient = this.fcmClient;
                    resolve(this.fcmClient);
                },
                async message=>{
                    await this.handleFcmMessage(message);
                }
            )            
            UtilDOM.doOnUnload(()=>{
                this.checkConnectedClients();
            });
        });
    }
    async checkConnectedClients(){
        const myDeviceId = this.myDeviceId
        const authToken = await this.getAuthToken();
        (await this.loadFcmClient()).reportWindowUnloaded({myDeviceId,authToken});
    }
    async handleFcmMessage(message){
        console.log("New Message!",message);
        const result = await this.fcmClient.handleMessage(message);

        console.log("Message result",result);
    }
    get alreadyAskedRegistration(){
        return AppContext.context.localStorage.getBoolean("alreadyAskedRegistration");
    }
    set alreadyAskedRegistration(value){
        AppContext.context.localStorage.set("alreadyAskedRegistration",value);
    }
    get myDeviceName(){
        return AppContext.context.localStorage.get("myDeviceName");
    }
    set myDeviceName(value){
        AppContext.context.localStorage.set("myDeviceName",value);
    }
    get myDeviceId(){
        return AppContext.context.getMyDeviceId();
    }
    set myDeviceId(value){
        AppContext.context.setMyDeviceId(value);
    }
    get isBrowserRegistered(){
        return (this.myDeviceId && this.myDeviceName) ? true : false;
    }
    async registerBrowser({force}){  
        var token = null;
        try{
            token = await this.fcmClient.getToken();
            const shouldTry = force || this.isBrowserRegistered || !this.alreadyAskedRegistration;
            if(!shouldTry) return;
    
            if(!token){
                console.log("Could not get push token. Not registering device.");
                return;
            }  
            if(!this.myDeviceName){
                const confirmed	= confirm("Do you want to register this browser as a Join device so you can interact with it remotely?\n\nPlease note that this is a beta feature and may not fully work yet.")
                this.alreadyAskedRegistration = true;
                if(!confirmed) return;
                
                this.myDeviceName = await prompt("Please enter a name for this web browser so that it can receive Join pushes.")
                if(!this.myDeviceName) return;
            }
            
            const result = await Util.tryOrNull(()=>ApiServer.registerBrowser({deviceId:this.myDeviceId,deviceName:this.myDeviceName,token})) || {success:false}; 
            if(!result.success){
                return;
            }
            this.myDeviceId = result.deviceId;   
        } finally{
            const shouldShowRegistrationButton = !this.isBrowserRegistered && (token ? true : false);
            this.controlTop.showOrHideRegistrationButton(shouldShowRegistrationButton);            
            await EventBus.post(new RequestLoadDevicesFromServer());
        }                              
    }
    async getDevice(deviceId){
        const devices = await this.devicesFromDb;
        return devices.getDevice(deviceId);
    }
    
    get db(){ 
        return DB.get();
    }
    get dbDevices(){
        return (async ()=>{
            if(this._dbDevices) return this._dbDevices;
    
            await importDbDevices();
            this._dbDevices = new DBDevices(await this.db);
            return this._dbDevices;
        })();
    }
    /** @type {DBGCM} */
    get dbGCM(){
        if(this._dbGCM) return this._dbGCM;
        return (async ()=>{
            const DBGCM = (await import('./gcm/dbgcm.js')).DBGCM
            this._dbGCM = new DBGCM(this.db);
            return this._dbGCM;
        })();
    }
    
    get devicesFromDb(){
        return (async ()=>{
            const dbDevices = await this.dbDevices;
            const fromDb = await dbDevices.getAll();
            if(this._devices){
                this._devices.transferSockets(fromDb)
            }
            this._devices = fromDb;
            return fromDb
        })();
    }
    async setDevices(devices){        
        const dbDevices = (await this.dbDevices);
        await dbDevices.update(devices);
        this._devices = devices;
    }
    async updateDevice(device){
        const dbDevices = (await this.dbDevices);
        await dbDevices.updateSingle(device);
    }
    get toast(){
        if(this._toast) return this._toast;

        return (async ()=>{
            const Toast = (await import('./toast/toast.js')).Toast
            this._toast = new Toast();
            await this.addElement(this._toast);
            return this._toast;
        })()
    }
    async showToast(args){
        const toast = (await this.toast);
        await toast.show(args);
    }
    /** EventBus Methods */
    async onShowToast(args){
        await this.showToast(args);
    }
    async switchAccounts(){
        var chooseotheraccount = confirm("Want to switch accounts?");
        if(!chooseotheraccount) return;

        await (await this.googleAccount).signOut();
    }
    async onSignOutRequest(){        
        await this.switchAccounts(); 
    }
    async onRegisterBrowserRequest(){
        await this.registerBrowser({force:true});
    }
    async onAppNameClicked(appNameClicked){
        const event = appNameClicked.event;
        const x = event.clientX;
        const y = event.clientY;
        const choices = (await this.devicesFromDb).filter(device=>device.canBrowseFiles());
        const choiceToLabelFunc = device => device.deviceName;
        const ControlDialogSingleChoice = (await import("./dialog/controldialog.js")).ControlDialogSingleChoice
        const device = await ControlDialogSingleChoice.showAndWait({position:{x,y},choices,choiceToLabelFunc});
        if(!device) return;
        
        EventBus.post(new AppDeviceSelected(device));
    }
    async getAuthToken(){
        const account = await this.googleAccount;
        const currentUser = await account.getCurrentUser()
        return currentUser.token;
    }
    get userEmail(){
        return (async ()=>{
            const account = await this.googleAccount;
            const currentUser = await account.getCurrentUser()
            return currentUser.email;
        })();
    }
    get userImage(){
        return (async ()=>{
            const account = await this.googleAccount;
            const currentUser = await account.getCurrentUser()
            return currentUser.imageUrl;
        })();
    }
    async showNotification(options,gcm){
        const fcmClient = await this.loadFcmClient();
        await fcmClient.showNotification(options,gcm);
    }

    async replyToMessage({device,text,notification}){
        if(!device){
            await this.showToast({text:"No device to reply to.",isError:true});
            return;
        } 

        this.showToast({text:"Sending reply..."});
        await this.googleAccount;

        const gcmReply = await GCMNotificationBase.getGCMReply({senderId:device.deviceId,text,notification});
        await device.send(gcmReply);
        await this.showToast({text:"Reply sent!"});
    }
    
    async doNotificationAction({device,notificationButton,notification}){
        if(!device){
            await this.showToast({text:"No device for action.",isError:true});
            return;
        } 

        const gcmForAction = await GCMNotificationBase.getNotificationActionGcm({action:notificationButton.actionId,notification,deviceId:device.deviceId})
       
        //this.showToast({text:"Doing action remotely..."});
        await this.googleAccount;

        await device.send(gcmForAction);
        this.showToast({text:"Action performed!"});
    }
    async onRequestUpdateDevice(request){
        const dbDevices = await this.dbDevices;
        await dbDevices.updateSingle(request.device);
    }
    async onGCMLocalNetworkRequest(gcm){
        if(!this.isBrowserRegistered) return;

		var serverAddress = this.allowUnsecureContent ? gcm.serverAddress : gcm.secureServerAddress;
		var senderId = gcm.senderId;
		if(!serverAddress) return;

        
		const device = await this.getDevice(senderId)
        if(!device) return;
        
        try{
            const webSocketServerAddress = gcm.webSocketServerAddress;
            const allowUnsecureContent = this.allowUnsecureContent;
            const isLocalNetworkAvailable = await device.testIfLocalNetworkIsAvailable({serverAddress,webSocketServerAddress,allowUnsecureContent});
            console.log("Local Network avaialble?",isLocalNetworkAvailable,device);    
        }catch(error){
            console.log("Error testing local network",error);    
        }
        await this.updateDevice(device);
        await EventBus.post(new RequestRefreshDevices());
    }
    
    async onSettingSaved(settingSaved){
        const setting = settingSaved.setting;
        const isTheme = setting.id == SettingTheme.id
        const isAccent = setting.id == SettingThemeAccentColor.id
        if(!isTheme && !isAccent) return;

        const theme = isTheme ? SettingTheme.getThemeOption(settingSaved.value) : null;
        const accent = isAccent ? settingSaved.value : null;
        this.applyTheme(theme,accent);
    }
    applyTheme(theme,accent){
        if(!theme){
            theme = new SettingTheme().theme;
        }
        if(theme){
            UtilDOM.setCssVariable("theme-background-color",theme.backgroundColor)
            UtilDOM.setCssVariable("theme-background-color-panel",theme.backgroundColorPanel)
            UtilDOM.setCssVariable("theme-background-color-hover",theme.backgroundHover)
            UtilDOM.setCssVariable("theme-text-color",theme.textColor)
            UtilDOM.setCssVariable("theme-accent-color-lowlight",theme.accentColorLowlight)                
        }
        if(!accent){
            accent = new SettingThemeAccentColor().value;
        }
        if(accent){
            UtilDOM.setCssVariable("theme-accent-color",accent)
            const lightColor = UtilDOM.increaseBrightness(accent,50);
            const darkColor = UtilDOM.increaseBrightness(accent,-20);
            UtilDOM.setCssVariable("theme-accent-color-light",lightColor);
            UtilDOM.setCssVariable("theme-accent-color-dark",darkColor);
            let themeColorElement = document.querySelector("meta[name=theme-color]");
            if(!themeColorElement){
                themeColorElement = document.createElement("meta");
                themeColorElement.setAttribute("name","theme-color");
                document.head.appendChild(themeColorElement);
            }
            themeColorElement.setAttribute("content",accent);
        }
    }

    /** @type {GoogleDrive} */
    get googleDrive(){
        if(this._googleDrive) return this._googleDrive;

        this._googleDrive = new GoogleDrive(async ()=>await this.getAuthToken())

        return this._googleDrive;
    }
}

export class RequestLoadDevicesFromServer{}
class AppDeviceSelected{
    constructor(device){
        this.device = device;
    }
}
class RequestRefreshDevices{}