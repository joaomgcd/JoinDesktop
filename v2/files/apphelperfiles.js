
import { EventBus } from "../eventbus.js";
import { ControlFileList, ControlFilePath } from "./controlfile.js";
import { AppHelperBase } from "../apphelperbase.js";
import { UtilDOM } from "../utildom.js";
import { FileList } from "../files/files.js";
import { ControlDialogSingleChoice, SingleChoiceChosen } from "../dialog/controldialog.js";
const hasMentionedDragAndDropKey = "mentionedDragAndDrops";
const currentOrderKey = "currentOrder";
const currentOrderReverseKey = "currentOrderReverse";
/** @type {App} */
let app = null;
export class AppHelperFiles extends AppHelperBase{

/**
 * 
 * @param {App} _app 
 */
    constructor(args = {app,device}){
        super(args.app);
        app = args.app;
        this.device = args.device;
        this.subFolder = args.path;
        this.deviceId = args.files;
    }
    async load(){
        EventBus.register(this);
        if(this.deviceId){
            this.device = await app.getDevice(this.deviceId);
        }else{
            this.deviceId = this.device.deviceId;
        }
        app.controlTop.appNameClickable = true;
        await app.loadFcmClient();
       

        window.onpopstate = async () => {            
            this.subFolder = Util.getQueryParameterValue("path");
            await this.refreshFiles();
        }

        app.controlTop.shouldAlwaysShowImageRefresh = true;
        this.controlFiles = new ControlFileList(this.device);
        await app.addElement(this.controlFiles);
        UtilDOM.hide(this.controlFiles);
        this.setDevice(this.device,this.subFolder);
        if(!app.restoreBoolean(hasMentionedDragAndDropKey)){
            await alert("You can drag and drop a file here to upload it to that folder on your device");
            app.store(hasMentionedDragAndDropKey,true);
        }
    }
    async onAppNameClicked(appNameClicked){
        await app.showDeviceChoiceOnAppNameClicked(appNameClicked,device => device.canBrowseFiles())
    }
    async setDevice(device,subFolder = "/"){
        if(!device) return;

        app.filesDevice  = device;
        this.device = device;
        this.deviceId = device.deviceId;
        this.subFolder = subFolder;
        app.controlTop.appName = `${this.device.deviceName} Files`;
        await this.refreshFiles()
    }
    updateUrl(){
        const url = Util.getCurrentUrlWithParameters({files:this.device.deviceId,path:this.subFolder});
        Util.changeUrl(url);
    }
    /**
     * 
     * @param {FileList} fileList 
     */
    async updateControlFileList(fileList){
        this.fileList = fileList;
        await this.orderFiles(await this.fileList);
        this.controlFiles.fileList = fileList;
        await this.setControlFileListOrder();
        UtilDOM.show(this.controlFiles);
        this.loading = false;
    }
    set loading(value){
        app.controlTop.loading = value;
        this.controlFiles.loading = value;
    }
    async refreshFiles(){
        this.loading = true;
        const fileList = await this.refreshedFileList;
        if(!fileList) return;

       this.updateControlFileList(fileList);
    }
    get fileList(){
        if(this._fileList) return this._fileList;

        return (async () => {
            this._fileList = await this.refreshedFileList;
            return this._fileList;
        })();
    }
    set fileList(value){
        this._fileList = value;
    }
    get refreshedFileList(){
        return (async()=>{
            const path = this.subFolder;
            const fileList = await this.device.loadFiles({token: await app.getAuthToken(),path});
            if(!fileList) return;

            await this.orderFiles(fileList);
            this.fileList =  fileList;
            return fileList;
        })();
    }
    async orderFiles(fileList){
        if(!fileList || !fileList.files) return;

        const order = this.currentOrder;
        const reverse = this.currentOrderReverse;
        let orderFunc = file=>file.name.toLowerCase();
        if(order == ControlFilePath.OrderByDate){
            orderFunc = file=>file.date;
        }else if(order == ControlFilePath.OrderBySize){
            orderFunc = file=>file.size;
        }
        let orderFolder = file=>!file.isFolder;
        if(reverse){
            orderFolder = file=>file.isFolder;
        }
        return fileList.files.sortByMultiple(!reverse,orderFolder,orderFunc);
    }
    async onAppDeviceSelected(appDeviceSelected){
        await this.setDevice(appDeviceSelected.device);
    }
    async onRequestRefresh(){
        await this.refreshFiles();
    }
    async onRequestChangeFilePath(request){
        const file = request.file;        
        const path = (await this.fileList).getPathForFile(file);
        if(file.isFolder){
            this.subFolder = path;
            this.updateUrl();
            return await this.refreshFiles();
        }
        this.loading = false;
        const result = await this.device.openFile({token: await app.getAuthToken(),path});
        if(!result) return;

        this.loading = false;
    }
    async onRequestChangeToFolderFullPath(request){
        const path = request.path;
        this.subFolder = path;
        this.updateUrl();
        this.loading = true;
        return await this.refreshFiles();
    }
    async onRequestPushFiles(request){
        const files = request.files;
        if(!files) return;
        const token = await app.getAuthToken();
        const path = this.subFolder;
        await this.device.pushFiles({files,token,path});
        await this.refreshFiles();
    }
    async setControlFileListOrder(){
        await this.controlFiles.setOrder({order:this.currentOrder,inverted:this.currentOrderReverse});
    }
    get currentOrder(){
        return app.restoreString(currentOrderKey) || ControlFilePath.OrderAlphabetically;
    }
    set currentOrder(value){
        app.store(currentOrderKey,value);
    }
    get currentOrderReverse(){
        return app.restoreBoolean(currentOrderReverseKey) || false;
    }
    set currentOrderReverse(value){
        app.store(currentOrderReverseKey,value);
    }
    async onRequestOrderByFiles(request){
        const currentOrder = this.currentOrder;
        if(currentOrder == request.order){
            this.currentOrderReverse = !this.currentOrderReverse;
        }else{
            this.currentOrderReverse = false;
        }
        this.currentOrder = request.order;

        await this.orderFiles(await this.fileList);
        await this.setControlFileListOrder();
        this.controlFiles.fileList = this.fileList;
    }
    async onGCMFolder(gcm){
        const fileList = new FileList({raw:gcm,device:this.device});

        this.updateControlFileList(fileList);
    }
    async onGCMFile({errorMessage,url}){
        this.loading = false;
        app.controlTop.hideMessage();
        if(errorMessage){
            app.showToast({text:errorMessage,isError:true});
            return;
        }
        Util.openWindow(url);
    }
}