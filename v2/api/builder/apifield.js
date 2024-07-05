export class ApiFields extends Array{
    static get generatedUrlFieldId(){
        return "generatedUrl";
    }
    constructor(initial){
        if(Number.isInteger(initial)){
            super(initial);
			return;
        }
        super();
        this.push(new ApiField({id:ApiFields.generatedUrlFieldId,label:"Fill in fields below then select -> Copy URL to use"}));
        this.push(new ApiField({id:"deviceNames",label:"Device Names - list of device names to send to separated by commas"}));
        this.push(new ApiField({id:"text",label:"Text - Tasker Command or notification text"}));
        this.push(new ApiField({id:"title",label:"Title - If set will create notification"}));
        this.push(new ApiField({id:"icon",label:"Icon URI - publicly accessible URL or local file URI; used whenever a notification is created"}));
        this.push(new ApiField({id:"smallicon",label:"Status Bar Icon URI (Android 6 and above) - publicly accessible URL or local file URI; used whenever a notification is created)"}));
        this.push(new ApiField({id:"url",label:"Url"}));
        this.push(new ApiField({id:"image",label:"Image URI - publicly accessible URL or local file URI; used whenever a notification is created"}));
        this.push(new ApiField({id:"sound",label:"Sound URI - publicly accessible URL or local file URI; used whenever a notification is created"}));
        this.push(new ApiField({id:"group",label:"Notification Group (Android 7 and above) - allows you to join notifications in different groups"}));
        this.push(new ApiField({id:"category",label:"Notification Category (Android 8 and above) - allows you to customize notification properties"}));
        this.push(new ApiField({id:"notificationId",label:"Notification ID - set the same ID to replace a previous notification"}));
        this.push(new ApiField({id:"clipboard",label:"Clipboard"}));
        this.push(new ApiField({id:"file",label:"File (must be a publicly accessible URL)"}));
        this.push(new ApiField({id:"callnumber",label:"Phone Call Number"}));
        this.push(new ApiField({id:"smsnumber",label:"SMS Number - if sending SMS must also fill in SMS Text below"}));
        this.push(new ApiField({id:"smstext",label:"SMS Text - if sending SMS must also fill in SMS Number above"}));
        this.push(new ApiField({id:"mmsfile",label:"MMS File - if sending MMS must also fill in SMS Number above"}));
        this.push(new ApiField({id:"wallpaper",label:"Wallpaper - must be publicly accessible URL"}));
        this.push(new ApiField({id:"lockWallpaper",label:"Lockscreen Wallpaper (Android 7 and above) - must be publicly accessible URL"}));
        this.push(new ApiField({id:"mediaVolume",label:"Media Volume - number"}));
        this.push(new ApiField({id:"ringVolume",label:"Ring Volume - number"}));
        this.push(new ApiField({id:"alarmVolume",label:"Alarm Volume - number"}));
        this.push(new ApiField({id:"say",label:"Text To Say"}));
        this.push(new ApiField({id:"language",label:"Language To Say Text"}));
        this.push(new ApiField({id:"app",label:"App Name To Launch"}));
        this.push(new ApiField({id:"appPackage",label:"App Package To Launch"}));
    }
}

export class ApiField{
    constructor({id,label}){
        this.id = id;
        this.label = label;
    }
}