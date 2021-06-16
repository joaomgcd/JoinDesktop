import { Control } from '../control.js';
import { UtilDOM } from '../utildom.js';
import { AppContext } from '../appcontext.js';
import { EventBus } from '../eventbus.js';

export class ControlTop extends Control{
    constructor(){
        super();
        EventBus.register(this);
    }
    getCurrentUser(){
        return this.googleUser;
    }
    getHtmlFile(){
        return "./v2/top/top.html";
    }
    getStyleFile(){
        return "./v2/top/top.css";
    }
    async renderSpecific({root}){
        this.imageBackElement = await this.$("#imageback");
        this.imageIconElement = await this.$("#imageicon");
        this.imageHomeElement = await this.$("#imagehome");
        this.imageMenuElement = await this.$("#imagemenu");
        this.messageElement = await this.$("#topmessage");
        this.versionElement = await this.$("#topversion");
        this.tabsElement = await this.$("#toptabs");
        this.appNameElement = await this.$("#appname");
        this.appNameArrowDownElement = await this.$("#appnamearrowdown");
        this.elementRightImage = await this.$("#userimage");
        this.elementLoading = await this.$("#refresh");
        this.registerBrowserElement = await this.$("#registerbrowser");
        this.imageRefreshElement = await this.$("#topBarRefresh");
        this.closeAppElement = await this.$("#closeapp");
        this.minimizeAppElement = await this.$("#minimizeapp");

        this.imageHomeElement.src = "./images/join.png";
        const appNameClicked = async e => await EventBus.post(new AppNameClicked(e));
        this.appNameElement.onclick = appNameClicked;
        this.appNameArrowDownElement.onclick = appNameClicked;
        this.registerBrowserElement.onclick = () => EventBus.post(new RegisterBrowserRequest());
        this.imageBackElement.onclick = () => EventBus.post(new RequestGoBack());
        this.imageMenuElement.onclick = () => EventBus.post(new RequestOpenMenu());
        this.elementRightImage.onclick = () => EventBus.post(new RightImageClicked());
        this.closeAppElement.onclick = () => EventBus.post(new MinimizeAppClicked());
        this.minimizeAppElement.onclick = () => EventBus.post(new MinimizeToTaskBarAppClicked());
        return root;
    }
    hideNavigation(){
        UtilDOM.hide(this.imageBackElement);
        UtilDOM.hide(this.imageMenuElement);
    }
    hideHomeImage(){
        UtilDOM.hide(this.imageHomeElement);
    }
    showCloseAppButton(){
        UtilDOM.show(this.closeAppElement);
    }
    showMinimizeAppButton(){
        UtilDOM.show(this.minimizeAppElement);
    }
    showHomeImage(){
        UtilDOM.show(this.imageHomeElement);
    }
    showBack(){
        UtilDOM.hide(this.imageMenuElement);
        UtilDOM.show(this.imageBackElement);
    }
    showMenu(){
        UtilDOM.hide(this.imageBackElement);
        UtilDOM.show(this.imageMenuElement);
    }
    set userImage(value){
        UtilDOM.setImageSourceOrHide(this.elementUserImage,value);
    }
    set homeImage(value){
        UtilDOM.setImageSourceOrHide(this.imageHomeElement,value);
    }
    set iconImage(value){
        UtilDOM.setImageSourceOrHide(this.imageIconElement,value);
    }
    set rightImage(value){
        UtilDOM.setImageSourceOrHide(this.elementRightImage,value);
    }
    set versionNumber(versionNumber){
       this.versionElement.innerHTML = `v${versionNumber}`;
    }
    async hideMessage(){
        await this.setMessage(null);
    }
    async setMessage(message){
        const messageElement = this.messageElement;
        if(!message){
            UtilDOM.hide(messageElement);
            messageElement.innerHTML = "";
            return;
        }
        UtilDOM.show(messageElement);
        if(message.innerHTML){
            message = message.innerHTML;
        }
        messageElement.innerHTML = message;
    }
    set appName(value){
        this.appNameElement.innerHTML = value;
    }
    set appNameClickable(value){
        UtilDOM.addOrRemoveClass(this.appNameElement,value,"clickable");
        UtilDOM.showOrHide(this.appNameArrowDownElement,value);
    }
    async showOrHideRegistrationButton(show){
        UtilDOM.showOrHide(this.registerBrowserElement,show);
    }
    set loading(value){
        UtilDOM.showOrHide(this.elementLoading,value || this.shouldAlwaysShowImageRefresh);
        UtilDOM.addOrRemoveClass(this.imageRefreshElement,value,"rotating");
        if(!value){
            this.hideMessage()
        }
    }
    get shouldAlwaysShowImageRefresh(){
        return this._shouldAlwaysShowImageRefresh ? true : false;
    }
    set shouldAlwaysShowImageRefresh(value){
        value = value ? true : false;
        UtilDOM.addOrRemoveClass(this.imageRefreshElement,value,"clickable");
        if(value){
            this.imageRefreshElement.onclick = async () => await EventBus.post(new RequestRefresh());
        }else{
            this.imageRefreshElement.onclick = null;
        }
        this._shouldAlwaysShowImageRefresh = value ;
    }
    async onStatusReport(report){
        await this.setMessage(report.message);
    }
}
class RegisterBrowserRequest{}
class SignOutRequest{}
class RequestGoBack{}
class RequestOpenMenu{}
class RequestRefresh{}
class AppNameClicked{
    constructor(event){
        this.event = event;
    }
}
class RightImageClicked{}
class CloseAppClicked{}
class MinimizeAppClicked{}
class MinimizeToTaskBarAppClicked{}