import { Util } from '../v2/util.js';
import { UtilServer } from './serverutil.js';

const { nativeImage , Notification } = require('electron')
const notifier = require('node-notifier');
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
    async show(){  
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
        this.timeout = 100000;
        this.wait = true;
        //CHANGE TO MAKING BASE64 images AVAILABLE AS FILES
        // delete this.icon;
        // delete this.badge;
        delete this.appName;
        // this.appName = "Join";      
        if(this.icon){
            this.icon = await UtilServer.imageToFilePath(this.id||"tempfile.png",this.icon,this.authToken);
            this.deleteIcon = true;
        }else{
            this.icon = await UtilServer.getServerFilePath("../images/join.png");
        }
        return await new Promise((resolve,reject)=>{
            // console.log("Showing notification",this);
            notifier.notify(this,(err, action, metadata) => { 
                try{
                if(!action || action == "timeout" || action == "dismissed") {
                    console.log("Ignoring Notification action",action,metadata);  
                    reject(action);
                    return;
                }

                console.log("Clicked notification original action",action,metadata);           
                if(action == "activate"){
                    action = null;
                }else{
                    action = this.originalActions.find(originalAction=>originalAction.title == metadata.button);
                    if(!action){
                        action = this.originalActions[0].action;
                    }else{
                        action = action.action;
                    }
                }
                console.log("Clicked notification",action);
                resolve(action);
                        
                }finally{
                    if(this.deleteIcon){
                        UtilServer.deleteFile(this.icon);
                    }
                }
            });
        })
    }
    static show(args){

        if(!args.title) return;
        
        const notification = new ServerNotification(args);
        return notification.show();
    }
}