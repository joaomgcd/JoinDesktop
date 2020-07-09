import { Control } from "../control.js"
import { FAB } from "./fab.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

export class ControlFAB extends Control{
    /**
     * 
     * @param {FAB} fab 
     * @param {FAB[]} secondaryFabs 
     */
    constructor(fab,secondaryFabs){
		super();
        this.fab = fab;
        this.secondaryFabs = secondaryFabs;
    }
    getHtmlFile(){
        return "./v2/fab/fab.html";
    }
    getStyleFile(){
        return "./v2/fab/fab.css";
    }
    
    async renderSpecific({root}){       
        this.elementFab = await this.$(".fabprimary");
        this.elementSecondaryFabs = await this.$(".secondaryfabs");
        
        this.elementFab.onclick = async () => await EventBus.post(this.fab);
        this.elementFab.innerHTML = this.fab.icon;
        if(this.fab.color){
            this.elementFab.style.backgroundColor = this.fab.color;
        }
        if(!this.secondaryFabs || this.secondaryFabs.length == 0){
            UtilDOM.hide(this.elementSecondaryFabs);
            return;
        }
        UtilDOM.show(this.elementSecondaryFabs);
        let count = 1;
        for(const secondaryFab of this.secondaryFabs){
            const controlFab = new ControlFABSecondary(secondaryFab);
            const render = await controlFab.render();
            render.onclick = async () => await EventBus.post(secondaryFab);
            let offset = 64;
            if(count > 1){
                offset += 48 * (count-1);
            }
            render.style["bottom"] = `${offset}px`;
            this.elementSecondaryFabs.appendChild(render);
            count++;
        }
    }
}

export class ControlFABSecondary extends Control{
    /**
     * 
     * @param {FAB} fab 
     */
    constructor(fab){
		super();
        this.fab = fab;
    }
    getHtmlFile(){
        return "./v2/fab/fabsecondary.html";
    }
    getStyleFile(){
        return "./v2/fab/fabsecondary.css";
    }
    
    async renderSpecific({root}){       
        this.elementFab = root;
        
        this.elementFab.innerHTML = this.fab.icon;        
    }
}
