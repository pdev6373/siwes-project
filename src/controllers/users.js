const User = require('../models/User')
const bcrypt = require('bcrypt')
import { USER_ROLES } from '../utils/constants'
import jwt from 'jsonwebtoken'
import { sendOTP } from '../utils/sendOtp'

const getAllUsers = async (req, res) => {
    const users = await User.find().select('-password').lean()

    res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
    })
}

const createNewUser = async (req, res) => {
    const { role } = req.body

    // User should have only one role -> User or Company
    switch (role) {
        case USER_ROLES.guest: {
            const { email, password } = req.body

            // Validate entries
            if (!email || !password)
                return res.status(403).json({
                    success: false,
                    message: 'All fields are required',
                })

            // check if user exists
            const user = await User.findOne({ email }).exec()

            // user exist
            if (user) {
                // user is verified
                if (user.isVerified)
                    return res.status(409).json({
                        success: false,
                        message: 'User is already registered',
                    })

                // user not verified
                user.role = role
                user.password = await bcrypt.hash(password, 10)

                await user.save()
                const sendOTPResponse = await sendOTP(email)

                return res.json(sendOTPResponse)
            }

            //  user does not exist
            const hashedPassword = await bcrypt.hash(password, 10)
            const userObject = {
                email,
                password: hashedPassword,
                role,
            }

            const isUserRegisterd = await User.create(userObject)

            if (isUserRegisterd) {
                const sendOTPResponse = await sendOTP(email)
                return res.json(sendOTPResponse)
            }

            return res
                .status(400)
                .json({ success: false, message: 'Invalid user data received' })
        }

        case USER_ROLES.business:
            return res
                .status(400)
                .json({ success: false, message: 'Coming soon..' })

        default:
            return res
                .status(400)
                .json({ success: false, message: 'Invalid user role' })
    }
}

const updateUser = async (req, res) => {
    const { role } = req.body

    switch (role) {
        case 'User': {
            const { id, email, password } = req.body

            if (!id || !email)
                return res.status(403).json({
                    success: false,
                    message: 'All fields are required',
                })

            const user = await User.findById(id).exec()

            if (!user)
                return res
                    .status(400)
                    .json({ success: false, message: 'User not found' })

            if (!user.isVerified)
                return res
                    .status(403)
                    .json({ success: false, message: 'User not verified' })

            const duplicate = await User.findOne({ email }).lean().exec()
            if (duplicate && duplicate?._id.toString() !== id)
                return res
                    .status(409)
                    .json({ success: false, message: 'Duplicate email' })

            user.email = email
            user.role = role

            if (password) user.password = await bcrypt.hash(password, 10)
            const updatedUser = await user.save()

            return res.json({
                success: true,
                message: `${updatedUser.email} updated`,
            })
        }

        case 'Company':
            return res
                .status(403)
                .json({ success: false, message: 'Coming soon..' })

        default:
            return res
                .status(403)
                .json({ success: false, message: 'Invalid user role' })
    }
}

const deleteuser = async (req, res) => {
    const { id } = req.body

    if (!id)
        return res
            .status(403)
            .json({ success: false, message: 'User Id required' })

    const user = await User.findById(id).exec()

    if (!user)
        return res
            .status(400)
            .json({ success: false, message: 'User not found' })

    const result = await user.deleteOne()

    res.json({
        success: true,
        message: `User ${result.email} with Id ${result._id} deleted`,
    })
}

const loginUser = async (req, res) => {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect email or password',
        })
    }

    if (!user.isVerified) {
        return res.status(401).json({
            success: false,
            message: 'Account not verified',
        })
    }

    const compareResult = await bcrypt.compare(password, user.password)

    if (!compareResult) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect email or password',
        })
    }

    const token = jwt.sign(
        {
            id: user.id,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '18000000',
        }
    )

    return res.json({
        success: true,
        message: 'Login successful',
        data: {
            token,
            user,
        },
    })
}

module.exports = {
    getAllUsers,
    createNewUser,
    updateUser,
    deleteuser,
    loginUser,
}
