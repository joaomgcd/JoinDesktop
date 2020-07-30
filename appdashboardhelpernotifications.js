import { AppHelperBase } from "./v2/apphelperbase.js";
import { AppDashboard, ServerEventBus } from "./appdashboard.js";
import { EventBus } from "./v2/eventbus.js";
import { UtilDOM } from "./v2/utildom.js";
import { NotificationInfo } from "./v2/notification/notificationinfo.js";

class RequestNotificationInfo{}
class RequestResize{
    constructor({width,height}){
        this.width = width;
        this.height = height;
    }
}
class MouseLeave{}
class MouseEnter{}
/** @type {AppDashboard} */
let app = null
export class AppDashboardNotifications extends AppHelperBase{
    constructor(appDashboard){
        super(appDashboard);
        app = appDashboard;
    }

    async load(){
        EventBus.register(this);            

        const {ControlNotificationClickHandler} = await import("./v2/gcm/notificationclickhandler/controlnotificationclickhandler.js")
        this.controlNotifications = new ControlNotificationClickHandler();
        this.controlNotifications.hideFAB = true;
        UtilDOM.setCssVariable("theme-background-color-panel","transparent");
        this.controlNotifications.backgroundColor = "transparent";
        await app.addElement(this.controlNotifications,app.rootElement)
        ServerEventBus.post(new RequestNotificationInfo());
        document.addEventListener("mouseleave", e=>ServerEventBus.post(new MouseLeave()))
        document.addEventListener("mouseenter", e=>ServerEventBus.post(new MouseEnter()))
    }
    async onThemeApplied(){
        UtilDOM.setCssVariable("theme-background-color-panel","transparent");
    }
    async onNotificationInfos(notificationInfos){
        if(!this.controlNotifications) return;

        const options = notificationInfos.options;
        if(!options) return;

        for(const optionsSingle of options){
            optionsSingle.device = await app.getDevice(optionsSingle.senderId);            
            optionsSingle.canClose = true;
        }
        console.log("Got notification infos",options);
        const {NotificationInfo} = await import("./v2/notification/notificationinfo.js")
        this.controlNotifications.notifications = options.map(optionsSingle=>new NotificationInfo(optionsSingle,optionsSingle.device));
        await this.controlNotifications.render();
        await Util.sleep(500);
        ServerEventBus.post(new RequestResize(this.controlNotifications.notificationsListSize));
    }
    async onRequestReplyMessage(request){
        ServerEventBus.post(request);
    }
    async onRequestNotificationClose(request){
        ServerEventBus.post(request);
    }
}