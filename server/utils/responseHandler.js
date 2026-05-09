// Standardizing return response.
export const response = (res, statusCode, message, data = null) => {
  // It is mandatory to send the Express "res-object" to pass the response via network call.
  if (!res) {
    console.error("Response object is null");
    return;
  }

  const responseObject = {
    status: statusCode < 400 ? "success" : "error",
    message,
    data,
  };
  return res.status(statusCode).json(responseObject);
};
