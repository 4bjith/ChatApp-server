import multer from "multer";;
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb)=>{
    if(file.mimetype.startsWith('image/')){
        cb(null, true);
    }else{
        cb(new Error('Only images are allowed!', false));
    }
}

export const upload = multer({
    storage,
    limits: {fileSize: 5 * 1024 * 1024}, // 5MB limit
    fileFilter
});