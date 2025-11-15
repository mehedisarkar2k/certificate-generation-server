import {
    prop,
    getModelForClass,
    modelOptions,
    Severity,
    Ref,
    index,
} from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { User } from './User.model'; @modelOptions({
    schemaOptions: {
        timestamps: true,
        collection: 'fonts',
    },
    options: {
        allowMixed: Severity.ALLOW,
    },
})
@index({ uploadedBy: 1 })
@index({ name: 1, uploadedBy: 1 })
export class Font {
    @prop({ required: true, type: () => String })
    public name!: string;

    @prop({ required: true, type: () => String })
    public fileName!: string;

    @prop({ required: true, type: () => String })
    public fontData!: string; // Base64 encoded font file

    @prop({ required: true, type: () => String })
    public mimeType!: string; // e.g., 'font/ttf', 'font/otf'

    @prop({ ref: () => User, required: true })
    public uploadedBy!: Ref<User>;

    @prop({ default: true, type: () => Boolean })
    public isActive!: boolean;

    @prop({ type: () => Object })
    public metadata?: Record<string, any>;

    public _id!: Types.ObjectId;

    public get id(): string {
        return this._id.toString();
    }
} export const FontModel = getModelForClass(Font);
