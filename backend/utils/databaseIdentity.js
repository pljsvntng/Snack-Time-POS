const ApiError=require('./ApiError');
const databaseIdentity=()=>process.env.POS_DATABASE_ID||null;
function assertDatabaseIdentity(claims){
 const expected=databaseIdentity();
 if(expected&&claims?.database_id!==expected)throw new ApiError(401,'This authorization belongs to another POS database. Sign in using the matching application. Saved receipts must be kept intact.');
}
module.exports={databaseIdentity,assertDatabaseIdentity};
