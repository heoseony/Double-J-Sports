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

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  logo: { width: 55, height: 55, marginBottom: 10 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  small: { fontSize: 9, color: "#333", marginBottom: 1 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 10 },
  metaTable: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 14,
  },
  metaCol: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#ccc",
  },
  metaColLast: { flex: 1, padding: 6 },
  metaLabel: { fontSize: 7, color: "#666", marginBottom: 2 },
  metaValue: { fontSize: 9 },
  invoiceToLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  invoiceToName: { fontSize: 11, marginBottom: 14 },
  itemsTable: { borderWidth: 1, borderColor: "#ccc", marginBottom: 14 },
  itemsHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  itemsRow: { flexDirection: "row" },
  itemsCellDesc: {
    flex: 3,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#ccc",
    fontSize: 9,
  },
  itemsCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#ccc",
    textAlign: "right",
    fontSize: 9,
  },
  itemsCellLast: { flex: 1, padding: 6, textAlign: "right", fontSize: 9 },
  headerCellText: { fontFamily: "Helvetica-Bold" },
  summary: { alignSelf: "flex-end", width: 200, marginBottom: 20 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 10,
  },
  summaryTotal: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  note: { fontSize: 9, marginBottom: 14 },
  paymentDetails: { fontSize: 9, lineHeight: 1.6 },
});

function getLogoDataUri() {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-watermark.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (e) {
    // 로고 파일을 못 읽으면 로고 없이 나머지는 정상 생성되게 한다.
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
        <Text style={styles.companyName}>{company.name}</Text>
        <Text style={styles.small}>{company.address}</Text>
        <Text style={styles.small}>
          Tel: {company.phone} · {company.email}
        </Text>

        <Text style={styles.title}>INVOICE</Text>

        <View style={styles.metaTable}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{invoiceNumber}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{issueDate}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment Terms</Text>
            <Text style={styles.metaValue}>Payment due upon receipt</Text>
          </View>
          <View style={styles.metaColLast}>
            <Text style={styles.metaLabel}>Referenz/Verwendungszweck</Text>
            <Text style={styles.metaValue}>{invoiceNumber}</Text>
          </View>
        </View>

        <Text style={styles.invoiceToLabel}>Invoice To:</Text>
        <Text style={styles.invoiceToName}>{memberNameEn}</Text>

        <View style={styles.itemsTable}>
          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.itemsCellDesc, styles.headerCellText]}>
              Description
            </Text>
            <Text style={[styles.itemsCell, styles.headerCellText]}>
              Quantity
            </Text>
            <Text style={[styles.itemsCell, styles.headerCellText]}>
              Unit Price
            </Text>
            <Text style={[styles.itemsCellLast, styles.headerCellText]}>
              Total
            </Text>
          </View>
          <View style={styles.itemsRow}>
            <Text style={styles.itemsCellDesc}>{description}</Text>
            <Text style={styles.itemsCell}>{quantity}</Text>
            <Text style={styles.itemsCell}>
              {fmtMoney(unitPrice)} {currencySymbol}
            </Text>
            <Text style={styles.itemsCellLast}>
              {fmtMoney(totalAmount)} {currencySymbol}
            </Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Net Amount:</Text>
            <Text>
              {fmtMoney(netAmount)} {currencySymbol}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>VAT 19%:</Text>
            <Text>
              {fmtMoney(vatAmount)} {currencySymbol}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text>Total:</Text>
            <Text>
              {fmtMoney(totalAmount)} {currencySymbol}
            </Text>
          </View>
        </View>

        <Text style={styles.note}>
          • Please include the invoice number as payment reference.
        </Text>

        <Text style={styles.invoiceToLabel}>Payment Details:</Text>
        <View style={styles.paymentDetails}>
          <Text>Bank: {bank.bankName}</Text>
          <Text>Account Holder: {bank.accountHolder}</Text>
          <Text>IBAN: {bank.iban}</Text>
          <Text>BIC: {bank.bic}</Text>
          <Text> </Text>
          <Text>{bank.amtsgericht}</Text>
          <Text>Handelsregister B: {bank.handelsregister}</Text>
          <Text>STEUER-NR.: {bank.steuerNr}</Text>
          <Text>USt-IdNr.: {bank.ustIdNr}</Text>
          <Text>EORI-Nr.: {bank.eoriNr}</Text>
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
