import { Control } from "../v2/control.js";
import { Logs, Log } from "./log.js";
import { UtilDOM } from "../v2/utildom.js";

export class ControlLogs extends Control {  
    /**
     * 
     * @param {Logs} logs 
     */ 
    constructor(logs){
        super();
        this.logs = logs;
    }
    getHtml(){
        return `
        <div id="logscontainer">
            <div id="logsheader">
                <div>Configure your web browser to use the companion app to make this app work.</div>
                <div>Performed actions will appear here.</div>
            </div>
            <div id="logs"></div>
        </div>
        `
    }
    getStyle(){
        return `
        #logscontainer{
            display: flex;
            flex-direction: column;
        }
        #logs{
            padding: 16px;
        }
        #logsheader{
            display:flex;
            flex-direction: column;
            align-self: center;
            align-items: center;
        }
        `
    }
    async renderSpecific({root}){
        this.logsElement = await this.$("#logs");
        this.headerElement = await this.$("#logsheader");

        this.renderList(this.logsElement,this.logs,ControlLog);
    }
    /**
     * 
     * @param {Log} log 
     */
    async addLog(log){
        if(!this.logsElement) return;

        const controlLog = new ControlLog(log);
        const render = await controlLog.render();
        this.logsElement.appendChild(render);
        UtilDOM.hide(this.headerElement);
    }
}
export class ControlLog extends Control {  
    /**
     * 
     * @param {Log} log
     */ 
    constructor(log){
        super();
        this.log = log;
    }
    getHtml(){
        return `
        <div class="log">
            <div class="logdate"></div>
            <div class="logtitle"></div>
            <div class="logtext"></div>
        </div>
        `
    }
    getStyle(){
        return `
        .log{
            display:flex;
            background-color: var(--theme-background-color);
            margin-bottom: 8px;
        }
        .logtitle{
            font-weight: bold;
            margin-right: 8px;
        }
        .logtext{
        }
        .logdate{
            margin-right: 8px;
        }
        `
    }
    async renderSpecific({root}){
        this.logElement = root;

        this.titleElement = await this.$(".logtitle");
        this.textElement = await this.$(".logtext");
        this.dateElement = await this.$(".logdate");

        UtilDOM.showOrHide(this.titleElement,this.log.title);
        this.titleElement.innerHTML = this.log.title;
        this.textElement.innerHTML = this.log.text;
        this.dateElement.innerHTML = this.log.date;
    }
}