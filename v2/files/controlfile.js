import { Files, FileList } from "./files.js";
import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";
import { Device } from "../device/device.js";
const rootFolder = "Internal Memory";
export class ControlFilePath extends Control{
    /**
     * 
     * @param {FileList} fileList 
     */
    constructor(fileList){
        super();
        this.fileList = fileList;
    }
    getHtmlFile(){
        return "./v2/files/filepath.html";
    }
    getStyleFile(){
        return "./v2/files/filepath.css";
    }
    async renderSpecific({root}){
        this.content = root;
        this.pathsElement = await this.$("#filepaths");
        this.orderAlphabeticallyElement = await this.$("#fileorderalphabetically");
        this.orderDateElement = await this.$("#fileorderdate");
        this.orderSizeElement = await this.$("#fileordersize");
        
        await this.refreshOrderArrows();
        this.orderAlphabeticallyElement.onclick = async () => await EventBus.post(new RequestOrderByFiles(ControlFilePath.OrderAlphabetically))
        this.orderDateElement.onclick = async () => await EventBus.post(new RequestOrderByFiles(ControlFilePath.OrderByDate))
        this.orderSizeElement.onclick = async () => await EventBus.post(new RequestOrderByFiles(ControlFilePath.OrderBySize))
        
        await this.refreshPath();
    }
    async refreshPath(fileList){
        this.fileList = fileList || this.fileList;
        this.pathsElement.innerHTML = "";
        //if(this.fileList.pathSegments.length == 0) return;
        const segments = this.fileList.pathSegments.slice();

        segments.splice(0,0,rootFolder);
        let currentPath = "";
        for(const pathSegment of segments){
            const pathSeparatorElement = document.createElement("div");
            pathSeparatorElement.innerHTML = "/";
            UtilDOM.addOrRemoveClass(pathSeparatorElement,true,"pathseparator");
            this.pathsElement.appendChild(pathSeparatorElement);

            const pathElement = document.createElement("a");
            pathElement.innerHTML = pathSegment;
            currentPath += `/${pathSegment}`
            const path = currentPath.replace(`/${rootFolder}`,"");
            pathElement.onclick = async () => await EventBus.post(new RequestChangeToFolderFullPath(path))
            UtilDOM.addOrRemoveClass(pathElement,true,"pathsegment");
            this.pathsElement.appendChild(pathElement);
        }
    }
    static get OrderAlphabetically(){
        return "alpha";
    }
    static get OrderByDate(){
        return "date";
    }
    static get OrderBySize(){
        return "size";
    }
    async hideAllOrderArrows(){
        const allOrders = await this.root.querySelectorAll("[order]");
        allOrders.forEach(order=>UtilDOM.hide(order));
    }
    async refreshOrderArrows(){
        const orderOptions = this.orderOptions;
        await this.hideAllOrderArrows();
        const currentOrder = await this.$(`#order${orderOptions.order}${orderOptions.inverted?"inverted":""}`);
        UtilDOM.show(currentOrder);
    }
    get orderOptions(){
        return this._order || {order:ControlFilePath.OrderAlphabetically,inverted:false};
    }
    async setOrder(args = {order,inverted}){
        this._order = args;
        await this.refreshOrderArrows();
    }
}
export class ControlFileList extends Control {
    /**
     * 
     * @param {Device} device 
     */
    constructor(device){
        super();
        this.device = device;
    }
    getHtmlFile(){
        return "./v2/files/filelist.html";
    }
    getStyleFile(){
        return "./v2/files/filelist.css";
    }
    set loading(value){
        UtilDOM.addOrRemoveClass(this.filesElement,value,"loading");
    }
    async renderSpecific({root}){
        this.content = root;
        this.pathElement = await this.$("#filepath");
        this.noFilesElement = await this.$("#nofiles");
        this.filesElement = await this.$("#files");
        this.fileDragOverElement = await this.$("#filedragover");
        
        UtilDOM.hide(this.fileDragOverElement);
        //UtilDOM.showOrHide(this.pathElement,this.fileList.pathSegments.length != 0);
        if(!this.controlFilePath){
            this.pathElement.innerHTML = "";
            this.controlFilePath = new ControlFilePath(this.fileList);
            const renderFilePath = await this.controlFilePath.render();
            this.pathElement.appendChild(renderFilePath);
        }else{
            this.controlFilePath.refreshPath(this.fileList);
        }
        this.filesElement.innerHTML = "";

        const areThereFiles = this.fileList.files.length > 0;
        UtilDOM.showOrHide(this.filesElement,areThereFiles);
        UtilDOM.showOrHide(this.noFilesElement,!areThereFiles);
        if(!areThereFiles) return;

        for(const file of this.fileList.files){
            const controlFile = new ControlFile(file);
            const render = await controlFile.render();
            this.filesElement.appendChild(render);
        }
        UtilDOM.handleDroppedFiles(this.content, async files => {
            UtilDOM.hide(this.fileDragOverElement);
            await this.requestPushFiles(files);
        },()=>{
            UtilDOM.show(this.fileDragOverElement);
        });
        return root;
    }
    async requestPushFiles(files){
        await EventBus.post(new RequestPushFiles(files));
    }
    set fileList(value){
        this._fileList = value;
        this.render();
    }
    get fileList(){
        return this._fileList || new FileList({device:this.device});
    }
    async setOrder(args={order,inverted}){
        await this.controlFilePath.setOrder(args);
    }
}
const iconFile = ``;
const iconFolder = ``;
export class ControlFile extends Control {
    constructor(file){
        super();
        this.file = file;
    }
    getHtmlFile(){
        return "./v2/files/file.html";
    }
    getStyleFile(){
        return "./v2/files/file.css";
    }
    async renderSpecific({root}){
        this.fileElement = root;
        this.iconElement = await this.$(".fileicon");
        this.iconFileElement = await this.$(".fileiconfile");
        this.iconFolderElement = await this.$(".fileiconfolder");
        this.nameElement = await this.$(".filename");
        this.sizeElement = await this.$(".filesize");
        this.dateElement = await this.$(".filedate");

        this.nameElement.innerHTML = this.file.name;
        this.sizeElement.innerHTML = this.file.isFolder ? "Directory" : Util.getFormatedFileSize(this.file.size,true,2);
        this.dateElement.innerHTML = this.file.date.formatDate({full:true});
        UtilDOM.showOrHide(this.iconFileElement,!this.file.isFolder);
        UtilDOM.showOrHide(this.iconFolderElement,this.file.isFolder);
        this.fileElement.onclick = async ()=> await EventBus.post(new RequestChangeFilePath(this.file))
        return root;
    }
}
class RequestChangeFilePath{
    constructor(file){
        this.file = file;
    }
}
class RequestChangeToFolderFullPath{
    constructor(path){
        this.path = path;
    }
}
class RequestPushFiles{
    constructor(files){
        this.files = files;
    }
}
class RequestOrderByFiles{
    constructor(order){
        this.order = order;
    }
}