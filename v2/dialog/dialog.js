class Dialog{

}

export class DialogSingleChoice extends Dialog{
    constructor({choices}){
        super()
        this.choices = choices;
    }
}

export class DialogInput extends Dialog{
    constructor({title,placeholder,initialText}){
        super()
        this.title = title;
        this.placeholder = placeholder;
        this.initialText = initialText;
    }
}
export class DialogProgress extends Dialog{
    constructor({title,text}){
        super()
        this.title = title;
        this.text = text;
    }
}
export class DialogOk extends Dialog{
    constructor({title,text,showCancel}){
        super()
        this.title = title;
        this.text = text;
        this.showCancel = showCancel;
    }
}