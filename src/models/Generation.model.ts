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
import { Template } from './Template.model';

export enum GenerationStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

@modelOptions({
    schemaOptions: {
        timestamps: true,
        collection: 'generations',
    },
    options: {
        allowMixed: Severity.ALLOW,
    },
})
@index({ userId: 1, status: 1 })
@index({ createdAt: -1 })
export class Generation {
    @prop({ ref: () => User, required: true })
    public userId!: Ref<User>;

    @prop({ ref: () => Template, required: true })
    public templateId!: Ref<Template>;

    @prop({ enum: GenerationStatus, default: GenerationStatus.PENDING, type: () => String })
    public status!: GenerationStatus;

    @prop({ required: true, type: () => Number })
    public totalCertificates!: number;

    @prop({ default: 0, type: () => Number })
    public processedCertificates!: number;

    @prop({ type: () => String })
    public zipPath?: string;

    @prop({ type: () => String })
    public batchDir?: string;

    @prop({ type: () => String })
    public errorMessage?: string;

    @prop({ type: () => Object })
    public metadata?: Record<string, any>;

    @prop({ type: () => Date })
    public completedAt?: Date;

    public _id!: Types.ObjectId;

    public get id(): string {
        return this._id.toString();
    }
}

export const GenerationModel = getModelForClass(Generation);
