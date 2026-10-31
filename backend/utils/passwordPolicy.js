const ApiError=require('./ApiError');
function administratorPassword(password){
 if(typeof password!=='string'||Array.from(password).length<15)throw new ApiError(400,'Administrator passwords must contain at least 15 characters. Use a unique passphrase or password manager.');
 if(Buffer.byteLength(password,'utf8')>72)throw new ApiError(400,'Administrator passwords must not exceed 72 UTF-8 bytes (bcrypt limit).');
 if(/[\u0000-\u001f\u007f]/.test(password)||/^(.)\1+$/u.test(password))throw new ApiError(400,'Choose a unique administrator passphrase without control characters or repeated single characters.');
 return password;
}
module.exports={administratorPassword};
