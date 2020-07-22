import { Util } from '../v2/util.js';
import { UtilServer } from './serverutil.js';
import { EventBus } from '../v2/eventbus.js';
const path = require('path')
const { nativeImage , Notification, BrowserWindow, screen  } = require('electron')
const notifier = require('node-notifier');
const stringHash = str => {
    var hash = 0, i, chr;
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
  const Store = require('./store.js');
  const storeNotifications = new Store({
      configName: 'notifications',
      defaults: []
  });
let debugging = false;
class WindowNotifications extends Array{	
	constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        EventBus.register(this);
        const options = storeNotifications.getData();
        options.forEach(option=>this.addNotification(new WindowNotification(option)));
    }
    
    async createWindowIfNeeded(){
        if(this.window) return;
        
        let notificationWidth = 0;
        let notificationHeight = 0;
        if(debugging){
            notificationWidth = 900;
            notificationHeight = 900;
        }
        const args = {
            x:0, 
            y:0, 
            width: notificationWidth, 
            height: notificationHeight, 
            //resizable: false, 
            backgroundColor: '#00FFFFFF', 
            frame:false,
            alwaysOnTop: true,
            skipTaskbar: true,
            acceptFirstMouse: true,
            transparent: true,
            webPreferences: {
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, '../preload.js'),
                allowRunningInsecureContent: true
            }
        }
        // console.log("Creating window for notification",args)
        
        const request = EventBus.waitFor(RequestNotificationInfo,3000);
        this.window = new BrowserWindow(args)
        this.window.loadFile('index.html',{ query: { notificationpopup: true }});
        if(debugging){
            this.window.webContents.toggleDevTools();
        }
        this.window.on("close",()=>this.window = null);
        await request;
    }
    findExistingNotification(notificationId){
        const index = this.findIndex(existing=>existing.options.id == notificationId);
        if(index < 0) return {index,windowNotification:null};

        const windowNotification = this[index];
        // console.log("Returning existing notification",index,windowNotification)
        return {index, windowNotification};
    }
    /**
     * 
     * @param {WindowNotification} windowNotification 
     */
    async addNotification(windowNotification){
        await this.createWindowIfNeeded();

        const {index} = this.findExistingNotification(windowNotification.options.id);

        if(index >= 0){
            this.splice(index,1);
        }
        this.push(windowNotification);
        await this.sendNotificationsToPage();
    }
    get storedNotifications(){
        return this.map(windowNotification=>windowNotification.options);
    }
    get notificationsToShow(){
        return this.filter(windowNotification=>windowNotification.shouldShow);
    }
    async purgeNotifications(){
        Util.removeIf(this,windowNotification=>windowNotification.canBeDiscarded);
        storeNotifications.setData(this.storedNotifications);
    }
    async onRequestStoredNotifications(){
        await this.purgeNotifications()
        const options = this.storedNotifications;
        await EventBus.post(new StoredNotifications(options));
    }
    async sendNotificationsToPage(){
        await this.purgeNotifications()
        const options = this.notificationsToShow.map(windowNotification=>windowNotification.options);
        const notificationInfos = new NotificationInfos(options);
        await this.sendToPageEventBus(notificationInfos);
        await EventBus.post(notificationInfos);
        await this.closeWindowIfNoNotifications();
    }
    async sendToPageEventBus(object){
        if(!this.window) return;

        await this.window.webContents.send('eventbus', {data:object,className:object.constructor.name});
    }
    async onRequestResize(request){
        if(!this.window) return;

        const width = request.width;
        const height = request.height;
        const display = screen.getPrimaryDisplay();
        const displayWidth = display.workArea.width;
        const displayHeight = display.workArea.height;
        const position = {x:displayWidth - width-16,y:displayHeight - Math.min(height,displayHeight)}

        if(debugging) return;

        // console.log("Chaging window by request",request,position);
        this.window.setPosition(position.x, position.y);
        this.window.setSize(width,height,true);
        
    }
    async onRequestNotificationAction({notificationButton,notification}){
        // console.log("Received notification action",notificationButton,notification);
        const {index,windowNotification} = this.findExistingNotification(notification.id);
        // console.log(`Existing notifications for id ${notification.id}`,windowNotification)
        if(!windowNotification){
            EventBus.post(new ResultNotificationAction(false));
            // console.log("No notification with id",notification.id,this)
            return;
        }
        const {GCMNotificationBase} = require("../v2/gcm/gcmbase.js");
        if(GCMNotificationBase.notificationDismissAction.action == notificationButton.action){
            this.splice(index,1);
            // await this.sendToPageEventBus(new RequestDimissNotification(notification.id))
            this.sendNotificationsToPage();
        }
        windowNotification.callActionCallback(notificationButton);
        
        await this.closeWindowIfNoNotifications();
        
        EventBus.post(new ResultNotificationAction(true));
    }
    async closeWindowIfNoNotifications(){
        if(this.notificationsToShow.length > 0) return;

        console.log("No notifications. Closing window.");
        await this.closeWindow();
    }
    async closeWindow(){
        if(!this.window) return;
        
        this.window.close();
        // this.length = 0;
        this.window = null;
    }
    async onNotificationsCleared(){
        this.length = 0;
        if(!this.window) return;       

        console.log("Notifications cleared. Closing window.");
        await this.closeWindow();
    }
    async onRequestReplyMessage(request){
        const requestFromServer = new RequestReplyMessageFromServer();
        Object.assign(requestFromServer,request);
        // console.log("Received reply request in notification",request);
        await EventBus.post(requestFromServer);
    }
    async onRequestNotificationClose({notification}){
        const {windowNotification} = this.findExistingNotification(notification.id || notification.tag);
        if(!windowNotification) return;

        console.log("Hiding",windowNotification)
        windowNotification.hidden = true;
        await this.sendNotificationsToPage();
    }
}
class RequestNotificationInfo{}
class RequestReplyMessageFromServer{}
class ResultNotificationAction{
    constructor(success){
        this.success = success;
    }
}
class WindowNotification{
    constructor(options){
        if(!options.timeout){
            options.timeout = 10000;
        }
        this.options = options;
        if(!this.options.id){
            const crypto = require("crypto");
            this.options.id = crypto.randomBytes(16).toString("hex");
        }
        this.timeCreated = new Date().getTime();
        this.timeoutTime = this.timeCreated + this.options.timeout;
    }
    set hidden(value){
        this.options.hidden = value;
    }    
    get hidden(){
        return this.options.hidden;
    }
    get shouldShow(){
        if(this.options.hidden) return false;
        if(this.options.requireInteraction) return true;

        return !this.hasTimedOut;
    }
    get hasTimedOut(){        
        return new Date().getTime() > this.timeoutTime;
    }
    get canBeDiscarded(){
        if(this.options.requireInteraction) return false;

        return this.options.discardAfterTimeout && this.hasTimedOut;
    }
    get wasShown(){
        return this._wasShown ? true : false;
    }
    set wasShown(value){
        this._wasShown = value ? true : false;
    }
    async notify(callback){
        this.callback = callback;
        await windowNotifications.addNotification(this);
        this.wasShown = true;
        if(this.options.requireInteraction) return;
        
        const timeout = this.options.timeout;
        console.log("Timing out notification after",timeout)
        setTimeout(async ()=> await windowNotifications.sendNotificationsToPage(),timeout);
    }
    async callActionCallback(notificationButton){
        if(!this.callback) return;

         console.log("Performing action in window notification",notificationButton);
        notificationButton.button = notificationButton.text
        this.callback(null,notificationButton.action,notificationButton,notificationButton.action);
    }
}
const windowNotifications = new WindowNotifications();
class NotificationInfos{
    constructor(options){
        this.options = options;
    }
}
class RequestDimissNotification{
    constructor(id){
        this.id = id;
    }
}
class StoredNotifications{
    constructor(options){
        this.options = options;
    }
}
export class ServerNotification{
    // constructor(args){
    //     Object.assign(this,args);
    //     if(!this.title){
    //         this.title = "Join";
    //     }
    //     if(!this.body && this.text){
    //         this.body = this.text;
    //     }
    //     if(!this.message && this.body){
    //         this.message = this.body;
    //     }
    //     if(this.icon && this.icon.startsWith("data:image")){
    //         this.icon = nativeImage.createFromDataURL(this.icon);
    //     }
    //     if(this.actions && this.actions.map){
    //         this.originalActions = [...this.actions];
    //         this.actions = this.actions.map(action=>{
    //             return {type:"button",text:action.title};
    //         });
    //     }
    //     this.timeoutType = "never";
    // }
    // show(){        
    //     // console.log("Showing notification",this);
    //     const notification = new Notification(this)
    //     notification.show();
    //     return new Promise((resolve,reject)=>{
    //         notification.on("action",(event,index)=>{
    //             console.log("Notification action",event,index);
    //             const originalAction =  this.originalActions[index];
    //             resolve(originalAction.action);
    //         });
    //     });
    // }
    constructor(args){
        Object.assign(this,args);
    }
    show(onClickCallback = null){  
        if(!this.title){
            this.title = "Join";
        }
        if(!this.body && this.text){
            this.body = this.text;
        }
        if(!this.message && this.body){
            this.message = this.body;
        }
        if(this.actions && this.actions.map){
            this.originalActions = [...this.actions];
            this.actions = this.actions.map(action=>action.title);
        }
        // this.d = "long";
        // this.timeout = 100000;
        this.wait = true;
        //CHANGE TO MAKING BASE64 images AVAILABLE AS FILES
        // delete this.icon;
        // delete this.badge;
        delete this.appName;
        // this.appName = "Join";      
        // if(this.icon){
        //     const fileName = this.id ? `${stringHash(this.id)}.png` : "tempfile.png";
        //     this.icon = await UtilServer.imageToFilePath(fileName,this.icon,this.authToken);
        //     this.deleteIcon = true;
        // }else{
        //     this.icon = await UtilServer.getServerFilePath("../images/join.png");
        // }
        return new Promise((resolve,reject)=>{
            const callback = (err, action, metadata,originalAction) => { 
                try{
                    if(action == "timeout" || action == "dismissed") {
                        console.log("Ignoring Notification action",action,metadata);  
                        reject(action);
                        return;
                    }

                    if(action){
                        // console.log("Clicked notification original action",action,metadata);    
                        if(action == "activate"){
                            action = null;
                        }else{
                            if(this.originalActions){
                                action = this.originalActions.find(originalAction=>originalAction.title == metadata.button);                            
                            }
                            if(!action && this.originalActions){
                                //action = this.originalActions[0].action;
                            }else{
                                action = action.action;
                            }
                        }
                        if(!action){    
                            if(originalAction){
                                action = originalAction;
                            }else{
                                action = metadata.button;
                            }  
                        }
                            
                    }
                    console.log("Clicked notification",action);
                    resolve(action);
                    if(onClickCallback){
                        onClickCallback(action);
                    }
                        
                }finally{
                    if(this.deleteIcon){
                        UtilServer.deleteFile(this.icon);
                    }
                }
            };
            console.log("Showing notification with text",this.body);
            const notificationWindow = new WindowNotification(this);
            notificationWindow.notify(callback)
            // const Growl = require('node-notifier/notifiers/growl');
            // new Growl().notify(this,callback);
            // notifier.notify(this,callback);
            // resolve();
        })
    }
    static show(args){
        const notification = new ServerNotification(args);
        return notification.show();
    }
}
if(debugging){    
    ServerNotification.show({title:"Join Companion App",body:"Now running!", timeout: 999999999999});
    ServerNotification.show({title:"Join Companion App 2",body:"Now running 2!"});
}