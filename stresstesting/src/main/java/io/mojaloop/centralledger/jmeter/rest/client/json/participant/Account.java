package io.mojaloop.centralledger.jmeter.rest.client.json.participant;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

/**
 */
@Getter
@Setter
public class Account extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private Long id;
	private String ledgerAccountType;
	private String currency;
	private boolean isActive;
	private Date createdDate;
	private String createdBy;

	public static class JSONMapping {
		public static final String ID = "id";
		public static final String NAME = "name";
		public static final String PASSWORD = "password";
		public static final String BALANCE = "balance";
		public static final String IS_DISABLED = "is_disabled";
		public static final String IS_ACTIVE = "isActive";
		public static final String CREATED_BY = "createdBy";
		public static final String LEDGER = "ledger";
		public static final String LEDGER_ACCOUNT_TYPE = "ledgerAccountType";
		public static final String CURRENCY = "currency";
		public static final String CREATED_DATE = "createdDate";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public Account(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.ID)) this.setId(jsonObject.getLong(JSONMapping.ID));
		if (jsonObject.has(JSONMapping.LEDGER_ACCOUNT_TYPE)) this.setLedgerAccountType(jsonObject.getString(JSONMapping.LEDGER_ACCOUNT_TYPE));
		if (jsonObject.has(JSONMapping.CURRENCY)) this.setCurrency(jsonObject.getString(JSONMapping.CURRENCY));
		if (jsonObject.has(JSONMapping.IS_ACTIVE)) this.setActive(jsonObject.getInt(JSONMapping.IS_ACTIVE) > 0);
		if (jsonObject.has(JSONMapping.CREATED_BY)) this.setCreatedBy(jsonObject.getString(JSONMapping.CREATED_BY));
		if (jsonObject.has(JSONMapping.CREATED_DATE)) {
			this.setCreatedDate(this.dateFrom(jsonObject, JSONMapping.CREATED_DATE));
		}
	}

	/**
	 *
	 * @return
	 * @throws JSONException
	 */
	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		//ID...
		if (this.getId() == null) returnVal.put(JSONMapping.ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.ID, this.getId());

		return returnVal;
	}
}
