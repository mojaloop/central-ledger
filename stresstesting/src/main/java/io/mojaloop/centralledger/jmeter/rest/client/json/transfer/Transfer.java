package io.mojaloop.centralledger.jmeter.rest.client.json.transfer;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

/**
 */
@Getter
@Setter
public class Transfer extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String transferId;
	private boolean fulfil;
	private String payerFsp;
	private String payeeFsp;
	private Amount amount;
	private String ilpPacket;//AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA
	private String condition;//GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM
	private Date expiration;//expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
	private List<Extension> extensionList;

	/*
	  },
  "condition": "GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM",
  "payeeFsp": "payeeFsp47384172",
  "ilpPacket": "AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA",
  "expiration": "2022-01-18T14:31:40.+01",
  "transferId": "454cc419-b560-4933-a6a1-66ed17bcd069",
  "fulfil": true
}
	 */
	//2022-01-18T14:31:40.+01 		(Broken)
	//2022-01-17T12:12:18.425Z

	public static class JSONMapping {
		public static final String TRANSFER_ID = "transferId";
		public static final String FULFIL = "fulfil";
		public static final String PAYER_FSP = "payerFsp";
		public static final String PAYEE_FSP = "payeeFsp";
		public static final String AMOUNT = "amount";
		public static final String ILP_PACKET = "ilpPacket";
		public static final String CONDITION = "condition";
		public static final String EXPIRATION = "expiration";
		public static final String EXTENSION_LIST = "extensionList";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Transfer(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.TRANSFER_ID)) this.setTransferId(jsonObject.getString(JSONMapping.TRANSFER_ID));
		if (jsonObject.has(JSONMapping.FULFIL)) this.setFulfil(jsonObject.getBoolean(JSONMapping.FULFIL));
		if (jsonObject.has(JSONMapping.PAYER_FSP) && !jsonObject.isNull(JSONMapping.PAYER_FSP)) {
			this.setPayerFsp(jsonObject.getString(JSONMapping.PAYER_FSP));
		}
		if (jsonObject.has(JSONMapping.PAYEE_FSP) && !jsonObject.isNull(JSONMapping.PAYEE_FSP)) {
			this.setPayeeFsp(jsonObject.getString(JSONMapping.PAYEE_FSP));
		}
		if (jsonObject.has(JSONMapping.AMOUNT)) this.setAmount(new Amount(jsonObject.getJSONObject(JSONMapping.AMOUNT)));
		if (jsonObject.has(JSONMapping.ILP_PACKET)) this.setIlpPacket(jsonObject.getString(JSONMapping.ILP_PACKET));
		if (jsonObject.has(JSONMapping.CONDITION)) this.setCondition(jsonObject.getString(JSONMapping.CONDITION));
		if (jsonObject.has(JSONMapping.EXPIRATION)) {
			this.setExpiration(this.dateFrom(jsonObject, JSONMapping.EXPIRATION));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getTransferId() == null) returnVal.put(JSONMapping.TRANSFER_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.TRANSFER_ID, this.getTransferId());

		returnVal.put(JSONMapping.FULFIL, this.isFulfil());

		if (this.getPayerFsp() == null) returnVal.put(JSONMapping.PAYER_FSP, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYER_FSP, this.getPayerFsp());

		if (this.getPayeeFsp() == null) returnVal.put(JSONMapping.PAYEE_FSP, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYEE_FSP, this.getPayeeFsp());

		if (this.getAmount() == null) returnVal.put(JSONMapping.AMOUNT, JSONObject.NULL);
		else returnVal.put(JSONMapping.AMOUNT, this.getAmount().toJsonObject());

		if (this.getIlpPacket() == null) returnVal.put(JSONMapping.ILP_PACKET, JSONObject.NULL);
		else returnVal.put(JSONMapping.ILP_PACKET, this.getIlpPacket());

		if (this.getCondition() == null) returnVal.put(JSONMapping.CONDITION, JSONObject.NULL);
		else returnVal.put(JSONMapping.CONDITION, this.getCondition());

		if (this.getExpiration() == null) returnVal.put(JSONMapping.EXPIRATION, JSONObject.NULL);
		else returnVal.put(JSONMapping.EXPIRATION, new SimpleDateFormat(DATE_AND_TIME_FORMAT).format(this.getExpiration()));

		return returnVal;
	}
}
