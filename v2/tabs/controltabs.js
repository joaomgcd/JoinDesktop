import { Control } from "../control.js"
import { EventBus } from "../eventbus.js";
import { UtilDOM } from "../utildom.js";

let useSelectedTabProperties = false;

export class ControlTabs extends Control{

    /**
     * 
     * @param {Tab[]} tabs 
     */
    constructor(tabs){
        useSelectedTabProperties = false;
        super(true);
        this.tabs = tabs;
        useSelectedTabProperties = true;
    }
    getPropertyTarget(key){
        if(!useSelectedTabProperties || key == "render" || key == "selectTab" || key == "selectedTab" || key == "unload") return this

        let target = this.selectedTab;
        if(!target){
            target = this;
        }else{
            target = target.controlContent;
        }
        return target;
    }
    setProperty(key,value){
        this.getPropertyTarget(key)[key] = value;
    }
    getProperty(key){
        return this.getPropertyTarget(key)[key];
    }
    getHtml(){
        return `
        <div class="tabsroot">
            <div class="tabtitles"></div>
            <div class="tabcontents"></div>
        </div>
        `
    }
    getStyle(){
        return `
            .tabsroot{                            
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            .tabtitles{  
                box-shadow: 0 1px 5px 0 rgba(60,64,67,.15), 0 4px 4px 0 rgba(60,64,67,.10), 0 -0.1px 3px 0 rgba(60,64,67,.08);
                z-index: 9999999;
                display: flex;
                background-color: var(--theme-accent-color);
                justify-content: space-around;
            }
            .tabcontents{  
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
        `
    }
    
    async unload(){
        useSelectedTabProperties = false;
        for(const tab of this.tabs){
            await tab.unload();
        }
        const result = await super.unload();
        useSelectedTabProperties = true;
        return result;
    }
    async render(){        
        useSelectedTabProperties = false;
        const result = await super.render();
        useSelectedTabProperties = true;
        return result;
    }
    async selectTab(tab){
        if(Util.isString(tab)){
            tab = this.tabs.find(toFind=>toFind.title == tab);
        }
        if(!tab){
            tab = this.tabs[0];
        }
        if(!tab) return;
        
        this.tabs.forEach(tab=>tab.selected = false);
        tab.selected = true;
    }
    async renderSpecific({root}){ 
        this.tabsElement = root;     
        this.tabTitlesElement = await this.$(".tabtitles");
        this.tabContentsElement = await this.$(".tabcontents");
        
        this.tabTitlesElement.innerHTML = "";
        for(const tab of this.tabs){
            const render = await tab.renderTitle();          
            render.onclick = async () => {
                useSelectedTabProperties = false;
                this.selectTab(tab);
                await EventBus.post(new TabSelected(tab));
                useSelectedTabProperties = true;
            }
            this.tabTitlesElement.appendChild(render);            
        }
        this.tabContentsElement.innerHTML = "";
        for(const tab of this.tabs){
            const render = await tab.renderContent();  
            this.tabContentsElement.appendChild(render);
        }
    }
    get selectedTab(){
        const tab = this.tabs.find(tab=>tab.selected);
        return tab;
    }
}
export class Tab {
    /**
     * 
     * @param {String} title 
     */
    constructor({title,selected,controlContent}){
        this.title = title;
        this.controlContent = controlContent;
        this.selected = selected;
    }
    
    async unload(){
        if(this.controlTabTitle){
            await this.controlTabTitle.unload();
        }
        await this.controlContent.unload();
    }
    async renderTitle(){
        if(!this.controlTabTitle){
            this.controlTabTitle = new ControlTabTitle(this.title);
        }
        this.renderedTitle = await this.controlTabTitle.render();
        return this.renderedTitle;
    }
    selectOrUnselectTab(){
        this.selectOrUnselectTitle();
        this.showOrHideContent();
    }
    selectOrUnselectTitle(){
        if(!this.renderedTitle) return;

        UtilDOM.addOrRemoveClass(this.renderedTitle,this.selected,"selected");
    }
    showOrHideContent(){
        if(!this.renderedContent) return;

        UtilDOM.showOrHide(this.renderedContent,this.selected);
    }
    async renderContent(){
        this.renderedContent = await this.controlContent.render();
        UtilDOM.showOrHide(this.renderedContent,this.selected); 
        this.selectOrUnselectTab();   
        return this.renderedContent;
    }
    async doOnContent(contentFunc){
        return await contentFunc(this.controlContent);
    }
    get selected(){
        return this._selected ? true : false;
    }
    set selected(value){
        this._selected = value ? true : false;
        if(!this.renderedContent) return;

        this.selectOrUnselectTab();    
    }
}
export class ControlTabTitle extends Control{
    /**
     * 
     * @param {String} title 
     */
    constructor(title){
        super();
        this.title = title;
    }
    getHtml(){
        return `
        <div class="tabtitle">
        </div>
        `
    }
    getStyle(){
        return `
            .tabtitle{
                height: 32px;
                cursor: pointer;
                font-weight: bold;
                display: flex;                
                align-items: center;
                padding: 8px;
                color: var(--theme-text-color-on-accent)
            }
            .tabtitle:hover{
                background-color: var(--theme-accent-color-light)
            }
            .tabtitle.selected{
                box-shadow: 0px -4px 0px var(--theme-text-color-on-accent) inset;
            }
        `
    }
    
    get selected(){
        return this._selected;
    }
    set selected(value){
        this._selected = value;      
    }
    async doOnContent(contentFunc){
        return await contentFunc(this.controlContent);
    }
    async renderSpecific({root}){ 
        this.titleElement = root;      

        this.titleElement.innerHTML = this.title;
    }
}
class TabSelected{
    constructor(tab){
        this.tab = tab;
    }
}