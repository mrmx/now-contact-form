'use strict';
const Boom = require("boom");
const Joi = require('@hapi/joi');
const fastify = require("fastify")({
  logger: true
});
const {
  NODE_ENV,
  MAIL_FROM,
  MAIL_TO,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_TLS,
  SMTP_USER,
  SMTP_PASS,
  CORS_ORIGIN,
  CORS_METHODS
} = process.env;
const env = NODE_ENV || "dev";
const DEV = env == "dev" || env == "development";
const PROD = env == "production";
//SMTP Config
const smtpConfig = {
  pool: true,
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT || 465),
  secure: SMTP_TLS == "true",
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  logger: DEV
};
if (DEV) console.log("SMTP config:", smtpConfig);
//CORS Config
const corsConfig = {
  origin: CORS_ORIGIN,
  methods: CORS_METHODS
};
if (DEV) console.log("CORS config:", corsConfig);
//Plugins
fastify.register(require('fastify-cors'), corsConfig);
fastify.register(require('fastify-nodemailer'), smtpConfig);
fastify.register(require('fastify-boom'))
fastify.register(require('fastify-helmet'))
//Joi schema
const schema = Joi.object().keys({
  name: Joi.string().min(2).max(64).required(),
  replyto: Joi.string().email().required(),
  subject: Joi.string().min(5).required(),
  message: Joi.string().min(15).max(1024).required()
})
//Main route
fastify.post("/",  async (req, reply) => {
  let form = req.body;
  if (DEV) console.log("Contact form request:",form);
  let validation = Joi.validate(form, schema);
  if (validation.error) {
    if (DEV) console.log("Validation error:", validation.error);
    fastify.log.error(validation.error);
    if (Array.isArray(validation.error.details)) {
      throw Boom.badRequest(validation.error.details[0].message);
    } else {
      throw Boom.badRequest("invalid request");
    }
  }
  if (DEV) console.log("Sending contact form to %s", MAIL_TO);
  try {
    fastify.nodemailer.sendMail(
      {
        from: `${form.name} <${MAIL_FROM}>`,
        to: MAIL_TO,
        replyTo: `${form.name} <${form.replyto}>`,
        subject: form.subject,
        text: form.message
      },
      (err, info) => {
        if (err) {
          fastify.log.error(err);
          if (PROD) {
            reply.send({
              status: "nok"
            });
          }
          reply.send(Boom.boomify(err));
          next(err);
        }
        if (DEV) {
          reply.send({
            status: "ok",
            response: info
          });
        } else
          reply.send({
            status: "ok"
          });
        }
    );
  } catch (err) {
    throw Boom.boomify(err);
  }
});
fastify.listen();