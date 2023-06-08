package io.mojaloop.centralledger.jmeter.rest.client.json.testdata;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

/**
 */
@Getter
@Setter
public class TestPlanConfig extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private int participantAccounts;
	private int transfers;
	private int rejections;
	private int transferLookups;
	private int accountLookups;
	private boolean transferSingleHttpRequest;
	private String transfersCurrency;

	public static class JSONMapping {
		public static final String PARTICIPANT_ACCOUNTS = "participant-accounts";
		public static final String TRANSFERS = "transfers";
		public static final String REJECTIONS = "rejections";
		public static final String TRANSFERS_SINGLE_HTTP_REQUEST = "transfers-single-http-request";
		public static final String TRANSFERS_CURRENCY = "transfers-currency";
		public static final String TRANSFER_LOOKUPS = "transfer-lookups";
		public static final String ACCOUNT_LOOKUPS = "account-lookups";
	}

	public TestPlanConfig(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.PARTICIPANT_ACCOUNTS)) this.setParticipantAccounts(jsonObject.getInt(JSONMapping.PARTICIPANT_ACCOUNTS));
		if (jsonObject.has(JSONMapping.TRANSFERS)) this.setTransfers(jsonObject.getInt(JSONMapping.TRANSFERS));
		if (jsonObject.has(JSONMapping.ACCOUNT_LOOKUPS)) this.setAccountLookups(jsonObject.getInt(JSONMapping.ACCOUNT_LOOKUPS));
		if (jsonObject.has(JSONMapping.TRANSFER_LOOKUPS)) this.setTransferLookups(jsonObject.getInt(JSONMapping.TRANSFER_LOOKUPS));
		if (jsonObject.has(JSONMapping.TRANSFERS_CURRENCY)) this.setTransfersCurrency(jsonObject.getString(JSONMapping.TRANSFERS_CURRENCY));
		if (jsonObject.has(JSONMapping.TRANSFERS_SINGLE_HTTP_REQUEST)) this.setTransferSingleHttpRequest(
				jsonObject.getBoolean(JSONMapping.TRANSFERS_SINGLE_HTTP_REQUEST));
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		returnVal.put(JSONMapping.PARTICIPANT_ACCOUNTS, this.getParticipantAccounts());
		returnVal.put(JSONMapping.TRANSFERS_CURRENCY, this.getTransfersCurrency());
		returnVal.put(JSONMapping.TRANSFER_LOOKUPS, this.getTransferLookups());
		returnVal.put(JSONMapping.TRANSFERS, this.getTransfers());
		returnVal.put(JSONMapping.ACCOUNT_LOOKUPS, this.getAccountLookups());
		returnVal.put(JSONMapping.TRANSFERS_SINGLE_HTTP_REQUEST, this.isTransferSingleHttpRequest());

		return returnVal;
	}
}
