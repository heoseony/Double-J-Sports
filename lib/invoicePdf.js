import fs from "fs";
import path from "path";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const ACCENT_RED = "#F01717";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Times-Roman" },
  logo: { width: 65, height: 86, marginBottom: 10, alignSelf: "center" },
  companyBox: {
    borderWidth: 1,
    borderColor: "#999",
    padding: 10,
    marginBottom: 6,
    alignItems: "center",
  },
  companyName: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  small: { fontSize: 9, color: "#333", marginBottom: 1, textAlign: "center" },
  title: {
    fontSize: 17,
    fontFamily: "Times-Bold",
    marginTop: 18,
    marginBottom: 14,
    textAlign: "center",
  },
  metaTable: {
    borderWidth: 1,
    borderColor: "#999",
    marginBottom: 20,
  },
  metaHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
  },
  metaValueRow: {
    flexDirection: "row",
  },
  metaCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#999",
    fontSize: 9,
    textAlign: "center",
  },
  metaCellLast: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    textAlign: "center",
  },
  metaCellAccent: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    textAlign: "center",
    color: ACCENT_RED,
  },
  invoiceToLabel: { fontSize: 10, fontFamily: "Times-Bold", marginBottom: 3 },
  invoiceToName: { fontSize: 10, marginBottom: 20 },
  itemsTable: { borderWidth: 1, borderColor: "#999", marginBottom: 20 },
  itemsHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
  },
  itemsRow: { flexDirection: "row" },
  itemsCellDesc: {
    flex: 3,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#999",
    fontSize: 9,
    textAlign: "center",
  },
  itemsCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#999",
    justifyContent: "center",
    alignItems: "center",
  },
  itemsCellLast: {
    flex: 1,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  itemsCellText: { fontSize: 9, textAlign: "center" },
  headerCellText: { fontFamily: "Times-Bold" },
  summaryLine: { fontSize: 10, marginBottom: 4 },
  summaryTotalLine: { fontSize: 10, fontFamily: "Times-Bold", marginBottom: 4 },
  noteRow: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 16 },
  noteDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT_RED,
    marginRight: 8,
  },
  noteText: { color: ACCENT_RED, fontFamily: "Times-Bold", fontSize: 10 },
  paymentTitle: { fontSize: 10, fontFamily: "Times-Bold", marginBottom: 4 },
  paymentLine: { fontSize: 10, lineHeight: 1.5 },
  footerBlock: { marginTop: 10 },
});

function getLogoDataUri() {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-invoice.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (e) {
    return null;
  }
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function generateInvoicePdfBuffer({
  invoiceNumber,
  issueDate,
  memberNameEn,
  description,
  quantity,
  unitPrice,
  netAmount,
  vatAmount,
  totalAmount,
  currencySymbol = "€",
  company,
  bank,
}) {
  const logoDataUri = getLogoDataUri();

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
        <View style={styles.companyBox}>
          <Text style={styles.companyName}>{company.name}</Text>
          <Text style={styles.small}>{company.address}</Text>
          <Text style={styles.small}>
            Tel: {company.phone} · {company.email}
          </Text>
        </View>

        <Text style={styles.title}>INVOICE</Text>

        <View style={styles.metaTable}>
          <View style={styles.metaHeaderRow}>
            <Text style={styles.metaCell}>Invoice No.</Text>
            <Text style={styles.metaCell}>Date</Text>
            <Text style={styles.metaCell}>Payment Terms</Text>
            <Text style={styles.metaCellAccent}>
              Referenz/Verwendungszweck
            </Text>
          </View>
          <View style={styles.metaValueRow}>
            <Text style={styles.metaCell}>{invoiceNumber}</Text>
            <Text style={styles.metaCell}>{issueDate}</Text>
            <Text style={styles.metaCell}>Payment due upon receipt</Text>
            <Text style={styles.metaCellAccent}>{invoiceNumber}</Text>
          </View>
        </View>

        <Text style={styles.invoiceToLabel}>Invoice To:</Text>
        <Text style={styles.invoiceToName}>{memberNameEn}</Text>

        <View style={styles.itemsTable}>
          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.itemsCellDesc, styles.headerCellText]}>
              Description
            </Text>
            <View style={styles.itemsCell}>
              <Text style={[styles.itemsCellText, styles.headerCellText]}>
                Quantity
              </Text>
            </View>
            <View style={styles.itemsCell}>
              <Text style={[styles.itemsCellText, styles.headerCellText]}>
                Unit Price
              </Text>
            </View>
            <View style={styles.itemsCellLast}>
              <Text style={[styles.itemsCellText, styles.headerCellText]}>
                Total
              </Text>
            </View>
          </View>
          <View style={styles.itemsRow}>
            <Text style={styles.itemsCellDesc}>{description}</Text>
            <View style={styles.itemsCell}>
              <Text style={styles.itemsCellText}>{quantity}</Text>
            </View>
            <View style={styles.itemsCell}>
              <Text style={styles.itemsCellText}>
                {fmtMoney(unitPrice)} {currencySymbol}
              </Text>
            </View>
            <View style={styles.itemsCellLast}>
              <Text style={styles.itemsCellText}>
                {fmtMoney(totalAmount)} {currencySymbol}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.summaryLine}>
          <Text style={{ fontFamily: "Times-Bold" }}>Net Amount:</Text>{" "}
          {fmtMoney(netAmount)} {currencySymbol}
        </Text>
        <Text style={styles.summaryLine}>
          <Text style={{ fontFamily: "Times-Bold" }}>VAT 19%:</Text>{" "}
          {fmtMoney(vatAmount)} {currencySymbol}
        </Text>
        <Text style={styles.summaryTotalLine}>
          Total: {fmtMoney(totalAmount)} {currencySymbol}
        </Text>

        <View style={styles.noteRow}>
          <View style={styles.noteDot} />
          <Text style={styles.noteText}>
            Please include the invoice number as payment reference.
          </Text>
        </View>

        <Text style={styles.paymentTitle}>Payment Details:</Text>
        <Text style={styles.paymentLine}>
          Bank: <Text style={{ fontFamily: "Times-Bold" }}>{bank.bankName}</Text>
        </Text>
        <Text style={styles.paymentLine}>
          Account Holder: {bank.accountHolder}
        </Text>
        <Text style={styles.paymentLine}>IBAN: {bank.iban}</Text>
        <Text style={styles.paymentLine}>BIC: {bank.bic}</Text>

        <View style={styles.footerBlock}>
          <Text style={styles.paymentLine}>{bank.amtsgericht}</Text>
          <Text style={styles.paymentLine}>
            Handelsregister B: {bank.handelsregister}
          </Text>
          <Text style={styles.paymentLine}>STEUER-NR.: {bank.steuerNr}</Text>
          <Text style={styles.paymentLine}>USt-IdNr.: {bank.ustIdNr}</Text>
          <Text style={styles.paymentLine}>EORI-Nr.: {bank.eoriNr}</Text>
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
