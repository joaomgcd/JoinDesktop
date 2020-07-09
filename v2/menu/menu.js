export class Menu extends Array{
    constructor(initial){
        if(Number.isInteger(initial)){
			super(initial);
			return;
        }
        super();
        initial.forEach(options=>{
            var entry = options;
            if(!Util.isType(entry,"MenuEntry")){
                entry = new MenuEntry(options);
            }
            this.push(entry)
        });
    }
}
export class MenuEntry{
    constructor(options){
        Object.assign(this,options);
    }
    get icon(){
        return this._icon;
    }
    set icon(value){
        this._icon = value;
    }
    get isIconSet(){
        return this.icon ? true : false;
    }
    get isIconSvg(){
        return this.isIconSet && this.icon.startsWith("<svg");
    }
    get label(){
        return this._label;
    }
    set label(value){
        this._label = value;
    }
}