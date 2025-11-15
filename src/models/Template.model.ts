import {
    prop,
    getModelForClass,
    modelOptions,
    Severity,
    Ref,
    index,
} from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { User } from './User.model';
import { TemplateType, FieldMapping } from '../types/certificate.types'; @modelOptions({
    schemaOptions: {
        timestamps: true,
        collection: 'templates',
    },
    options: {
        allowMixed: Severity.ALLOW,
    },
})
@index({ createdBy: 1 })
@index({ type: 1 })
export class Template {
    @prop({ required: true, type: () => String })
    public name!: string;

    @prop({ enum: TemplateType, required: true, type: () => String })
    public type!: TemplateType;

    @prop({ ref: () => User, required: true })
    public createdBy!: Ref<User>;

    @prop({ type: () => [Object], default: [] })
    public fields!: FieldMapping[];

    @prop({ type: () => [String], default: [] })
    public fontIds!: string[];

    @prop({ type: () => Object, default: {} })
    public metadata!: Record<string, any>;

    @prop({ default: true, type: () => Boolean })
    public isActive!: boolean;

    public _id!: Types.ObjectId;

    public get id(): string {
        return this._id.toString();
    }
} export const TemplateModel = getModelForClass(Template);
