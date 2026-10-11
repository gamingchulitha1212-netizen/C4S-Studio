/* Invoice email settings (EmailJS). See the setup steps in the instructions.
   Leave the three values empty until you have created your EmailJS account.
   The public key is meant to be public; in EmailJS, also restrict the allowed domains. */
window.C4S_INVOICE_CONFIG = {
  emailjs: {
    publicKey: '',   // EmailJS: Account > General > Public Key
    serviceId: '',   // EmailJS: Email Services > your service ID
    templateId: ''   // EmailJS: Email Templates > your template ID
  }
};
