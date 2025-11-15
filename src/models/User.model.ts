import {
    prop,
    getModelForClass,
    modelOptions,
    Severity,
    index,
} from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { PackageType } from '../types/certificate.types'; @modelOptions({
    schemaOptions: {
        timestamps: true,
        collection: 'users',
    },
    options: {
        allowMixed: Severity.ALLOW,
    },
})
@index({ email: 1 }, { unique: true })
export class User {
    @prop({ required: true, unique: true, type: () => String })
    public email!: string;

    @prop({ required: true, type: () => String })
    public name!: string;

    @prop({ required: true, type: () => String })
    public passwordHash!: string;

    @prop({ enum: PackageType, default: PackageType.FREE, type: () => String })
    public packageType!: PackageType;

    @prop({ default: 10, type: () => Number })
    public certificatesRemaining!: number;

    @prop({ default: 0, type: () => Number })
    public certificatesGenerated!: number;

    @prop({ default: true, type: () => Boolean })
    public isActive!: boolean;

    @prop({ default: false, type: () => Boolean })
    public isAdmin!: boolean;

    @prop({ type: () => Date })
    public lastLoginAt?: Date;

    public _id!: Types.ObjectId;

    public get id(): string {
        return this._id.toString();
    }
} export const UserModel = getModelForClass(User);
