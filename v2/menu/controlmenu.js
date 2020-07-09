import { Control } from "../control.js"
import { Menu, MenuEntry } from "./menu.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

const htmlMenu = `<div id="menubackground">
                    <div id="menu">		
                        <div id="menuheader">
                            <div id="imagecontainer"><img id="imageheader"/></div>
                            <div id="accountcontainer">
                                <div id="accountname"></div>
                                <div id="accountemail"></div>
                            </div>
                        </div>
                        <div id="menuentries"></div>
                    </div>
                </div>`;
const cssMenu = `
:root {
	--menu-width: 70vw;
	--menu-max-width: 300px;
}
#menubackground{
	background-color: rgba(0, 0, 0, 0.5);
	width: 100vw;
	height: 100vh;
	position: absolute;
	z-index: 100000;
	transition: all 0.3s;
}
#menuheader{	
    background-image: url(./images/account_background.png);
	background-size: contain;
	color: white;
	/* text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; */
	padding: 16px;
	cursor: pointer;
}
#menuheader #imageheader{
	max-width: 60px;
	border-radius: 100%;
}
#menuheader #accountname{
	font-size: large;
	font-weight: bold;
}
#menuheader #accountemail{
	font-size: small;
}

#menu{
	display: flex;
	flex-direction: column;
    position: absolute;
	background-color: var(--theme-background-color);
	transition: all 0.3s;
	width: var(--menu-width);
	max-width: var(--menu-max-width);
	height: 100vh;
	z-index: 1000000;
}
#menu.closed{
	margin-left: calc(0px - min(var(--menu-width), var(--menu-max-width)));
}
`;
export class ControlMenu extends Control{
    /**
     * 
     * @param {Menu} menu 
     */
    constructor(menu){
        super();
        this.menu = menu;
        this.controlsMenuEntries = menu.map(menuEntry=>new ControlMenuEntry(menuEntry));
        this.onCurrentGoogleUserChanged = async userChanged => {
            this.googleUser = userChanged.googleUser;
            await this.loadUserInfo();
        }
        EventBus.registerSticky(this);
    }
    getCurrentUser(){
        return this.googleUser;
    }
    // getHtmlFile(){
    //     return "./v2/menu/menu.html";
    // }
    getHtml(){
        return htmlMenu;
    }
    getStyle(){
        return cssMenu;
    }
    
    async renderSpecific({root}){ 
        this.menuBackgroundElement = root;  
        this.menuElement = await this.$("#menu");   
        this.menuHeaderElement = await this.$("#menuheader"); 
        this.menuEntriesElement = await this.$("#menuentries");     
        this.imageHeaderElement = await this.$("#imageheader");     
        this.accountNameElement = await this.$("#accountname");     
        this.accountEmailElement = await this.$("#accountemail");     

        this.close();
        this.menuHeaderElement.onclick = async () => await EventBus.post(new SignOutRequest());
        this.menuEntriesElement.innerHTML = "";
        for(const controlMenuEntry of this.controlsMenuEntries){
            const render = await controlMenuEntry.render();
            this.menuEntriesElement.appendChild(render);
        }
        this.menuBackgroundElement.onclick = e => this.close();
        const stop = () => {
            UtilDOM.setOnTouchMove(this.menuElement,null);
            this.menuBackgroundElement.style["transition"] = "all 0.3s";
            this.menuElement.style["transition"] = "all 0.3s";
            const endMargin = parseInt(this.menuElement.style["margin-left"].replace("px",""));
            const width = this.menuElement.clientWidth;
            //automatically close if user has hidden more than 1/4th of the menu
            if(endMargin <  (-width / 4)){
                this.close();
            }
            this.menuElement.style["margin-left"] = null;
        }
        UtilDOM.setOnTouchDownCoordinates(this.menuElement,e => {    
            //console.log("Touch Down!");
            const width = this.menuElement.clientWidth;
            this.menuBackgroundElement.style["transition"] = "all 0s";  
            this.menuElement.style["transition"] = "all 0s";     
            var initialX = e.coordinateX;
            UtilDOM.setOnTouchMoveCoordinates(this.menuElement,e =>{ 
                if(!Util.isType(e,"TouchEvent") && !e.buttons){
                    stop()
                    return;
                }
                e.preventDefault();
                const newX = e.coordinateX;
                //console.log(newX);
                var newMargin = newX-initialX;
                if(newMargin > 0){
                    newMargin = 0;
                    initialX = newX;
                }
                this.menuElement.style["margin-left"] = `${newMargin}px`;
                const margin = -newMargin;
                const opacity = margin * this.maxOpacity / width;
                this.backgroundTransparency = this.maxOpacity - opacity;
            });
            UtilDOM.setOnTouchUp(this.menuElement,stop);  
        });
        
    }
    set maxOpacity(value){
        this._maxOpacity = value;
    }
    get maxOpacity(){
        if(this._maxOpacity) return this._maxOpacity;

        return 0.75;
    }
    close(){
        UtilDOM.addOrRemoveClass(this.menuElement,true,"closed");
        this.backgroundTransparency = 0;
        setTimeout(()=>UtilDOM.hide(this.menuBackgroundElement),300);        
    }
    open(){
        UtilDOM.show(this.menuBackgroundElement);
        setTimeout(()=>UtilDOM.addOrRemoveClass(this.menuElement,false,"closed"),0);        ;
        this.backgroundTransparency = this.maxOpacity;
    }
    set backgroundTransparency(value){
        this.menuBackgroundElement.style["background-color"] = `rgba(0, 0, 0, ${value})`;
    }
    
    findSelectedControlMenuEntry(){
        return this.controlsMenuEntries.find(controlMenuEntry => controlMenuEntry.isSelected);
    }
    set selectedEntry(menuEntry){
        const controlMenuEntry = this.controlsMenuEntries.find(controlMenuEntry => {
            return Object.is(controlMenuEntry.menuEntry,menuEntry)
        });
        this.controlsMenuEntries.forEach(controlMenuEntry=>controlMenuEntry.isSelected = false)
        controlMenuEntry.isSelected = true;
    }
    async onMenuEntry(menuEntry){
        this.selectedEntry = menuEntry;
    }
    async loadUserInfo(){
        if(!this.accountNameElement) return;

        const user = this.getCurrentUser();
        this.imageHeaderElement.src = user.imageUrl;
        this.accountNameElement.innerHTML = user.name;
        this.accountEmailElement.innerHTML = user.email;
    }
    async renderTabsTo(element){
        element.innerHTML = "";
        const selected = this.findSelectedControlMenuEntry();
        for(const menuEntry of this.menu){
            const control = new ControlMenuEntry(menuEntry,true);
            control.isSelected = Object.is(selected.menuEntry,menuEntry);
            let render = await control.render();
            element.appendChild(render);
        }
    }
}
const cssMenuEntry = `
.menuentry{
	display: flex;
	padding: 16px;
	padding-top: 8px;
	padding-bottom: 8px;
    cursor: pointer;
}
.menuentry.nolabel{
	padding: 0px;
}
.menuentry .icon{
}
.menuentry .label{
    margin-left: 32px;
}
.menuentry.nolabel .label{
    display: none;
}
.menuentry.selected{
	background-color: var(--theme-accent-color-light);
}
.menuentry.nolabel.selected{
	background-color: transparent;
}
.menuentry svg{
	fill: var(--theme-text-color);
}
`
const htmlMenuEntry = `
<div class="menuentry">
    <div class="icon"><img /></div>
    <div class="label"></div>
</div>
`
export class ControlMenuEntry extends Control{
    /**
     * 
     * @param {MenuEntry} menuEntry 
     */
    constructor(menuEntry,hideLabel){
        super();
        this.menuEntry = menuEntry;
        this.hideLabel = hideLabel;
        EventBus.register(this);
    }
    // getHtmlFile(){
    //     return "./v2/menu/menuentry.html";
    // }
    // getStyleFile(){
    //     return "./v2/menu/menuentry.css";
    // }
    getHtml(){
        return htmlMenuEntry;
    }
    getStyle(){
        return cssMenuEntry;
    }
    
    async onMenuEntry(menuEntry){
        UtilDOM.addOrRemoveClass(this.menuElement,this.menuEntry == menuEntry,"selected");
    }
    async renderSpecific({root}){ 
        this.menuElement = root;     
        this.iconElement =  await this.$(".icon");   
        this.iconImage =  this.iconElement.querySelector("img");     
        this.labelElement = await this.$(".label");   

        UtilDOM.addOrRemoveClass(this.menuElement,this.hideLabel,"nolabel");
        UtilDOM.addOrRemoveClass(this.menuElement,this.isSelected,"selected");
        if(this.menuEntry.isIconSet){
            if(this.menuEntry.isIconSvg){
                this.iconElement.innerHTML = this.menuEntry.icon;
            }else{
                this.iconImage.src = this.menuEntry.icon;
            }
        }else{
            UtilDOM.hide(this.iconElement);
        }
        this.labelElement.innerHTML= this.menuEntry.label;
        this.menuElement.onclick = e => EventBus.post(this.menuEntry);
    }
    get isSelected(){
        return this._isSelected;
    }
    set isSelected(value){
        this._isSelected = value;
        this.render();
    }
}
class SignOutRequest{}