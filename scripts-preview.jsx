import fs from "fs";
import os from "os";
import path from "path";
import { generateInvoicePdfBuffer } from "./scripts-preview-invoicePdf.jsx";

const company = {
  name: "Double J GmbH",
  address: "Bergiusstr. 15 · 40880 Ratingen · Germany",
  phone: "+49 177 218 1134",
  email: "2021doublej@gmail.com",
};
const bank = {
  bankName: "FYRST",
  accountHolder: "Double J GmbH",
  iban: "DE94 3007 0207 0080 0789 00",
  bic: "DEUTDEDDP06",
  amtsgericht: "Amtsgericht Düsseldorf",
  handelsregister: "HRB 111212",
  steuerNr: "147/5817/1945",
  ustIdNr: "DE460052661",
  eoriNr: "DE265124677011017",
};

async function make(file, total, withAddress) {
  const net = Math.round((total / 1.19) * 100) / 100;
  const vat = Math.round((total - net) * 100) / 100;
  const buf = await generateInvoicePdfBuffer({
    invoiceNumber: "2026-999",
    issueDate: "10.11.2026",
    memberNameEn: "Test Member",
    memberAddress: withAddress ? { street: "Teststrasse 1", zip: "60311", city: "Frankfurt" } : {},
    description: "Double J GmbH --\nAkademie-Training (Nov 2026)",
    quantity: 4,
    unitPrice: total / 4,
    netAmount: net,
    vatAmount: vat,
    totalAmount: total,
    company,
    bank,
  });
  const out = path.join(os.homedir(), "Desktop", file);
  fs.writeFileSync(out, buf);
  console.log("만들어짐:", out);
}

async function main() {
  await make("invoice-preview-1.pdf", 80, false);
  await make("invoice-preview-2-주소포함.pdf", 280, true);
}
main().catch((e) => {
  console.error("실패:", e);
  process.exit(1);
});
