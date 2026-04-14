const { success } = require('../utils/response');
const chatbotService = require('../services/chatbotService');

async function sendMessage(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { message, conversationHistory, analyticsContext } = req.body;

    const result = await chatbotService.processMessage(
      userId,
      message,
      Array.isArray(conversationHistory) ? conversationHistory : [],
      analyticsContext
    );

    return success(res, result, 'Chatbot response generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = { sendMessage };
