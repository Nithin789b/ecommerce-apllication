
import userModel from "./user.modal.js";
import bcrypt from "bcryptjs";

//verify the user by using email
export const findUserByEmail = async (email) => {
    const normalizedEmail = email.trim();
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return userModel.findOne({ email: new RegExp(`^${escapedEmail}$`, "i") });
};

//create user by using the details provided in the request body
export const createUser = async ({
    username,
    email,
    phone_number,
    password
}) => {
    const hashedPassword = await bcrypt.hash(password, 12);

    return await userModel.create({
        username,
        email: email.trim().toLowerCase(),
        phone_number,
        password: hashedPassword
    });
};

export const verifyPassword = async (enteredPassword, hashedPassword) => {
    return await bcrypt.compare(enteredPassword, hashedPassword);
};

export const saveRefreshTokenHash = async (userId, refreshTokenHash) =>
    userModel.updateOne({ _id: userId }, { $set: { refreshTokenHash } });

export const findUserByIdWithRefreshToken = async (userId) =>
    userModel.findById(userId).select("+refreshTokenHash");

export const findUserRoleById = async (userId) =>
    userModel.findById(userId).select("role");

export const clearRefreshTokenHash = async (userId) =>
    userModel.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } });

export const savePasswordReset = async (userId, tokenHash, expiresAt) =>
    userModel.updateOne(
        { _id: userId },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
    );

export const findUserByPasswordResetHash = async (tokenHash) =>
    userModel.findOne({ passwordResetTokenHash: tokenHash })
        .select("+passwordResetTokenHash +passwordResetExpiresAt");

export const updatePasswordWithResetToken = async (tokenHash, hashedPassword) =>
    userModel.findOneAndUpdate(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
        {
            $set: {
                password: hashedPassword,
                passwordResetTokenHash: null,
                passwordResetExpiresAt: null,
                refreshTokenHash: null
            }
        },
        { new: true, runValidators: true }
    );

export const saveDefaultAddress = async (userId, defaultAddress) =>
    userModel.findByIdAndUpdate(
        userId,
        { $set: { defaultAddress } },
        { new: true, runValidators: true }
    );
