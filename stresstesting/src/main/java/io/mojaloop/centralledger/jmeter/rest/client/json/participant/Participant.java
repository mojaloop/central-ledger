package io.mojaloop.centralledger.jmeter.rest.client.json.participant;

import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 */
@Getter
@Setter
public class Participant extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String name;
	private String currency;
	private String password;
	private String id;
	private Date created;
	private boolean isActive;
	private boolean newlyCreated;
	private List<String> links;
	private List<Account> accounts;

	public static class JSONMapping {
		public static final String ID = "id";
		public static final String NAME = "name";
		public static final String CURRENCY = "currency";
		public static final String PASSWORD = "password";
		public static final String BALANCE = "balance";
		public static final String IS_ACTIVE = "isActive";
		public static final String LINKS = "links";
		public static final String SELF = "self";
		public static final String ACCOUNTS = "accounts";
		public static final String LEDGER = "ledger";
		public static final String CREATED = "created";
		public static final String NEWLY_CREATED = "newlyCreated";
	}

	public Participant(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.ID)) {
			Object obj = jsonObject.get(JSONMapping.ID);
			if (obj instanceof Number) {
				this.setId(Long.toString(((Number)obj).longValue()));
			} else {
				this.setId(obj.toString());
			}
		}

		if (jsonObject.has(JSONMapping.NAME)) this.setName(jsonObject.getString(JSONMapping.NAME));
		if (jsonObject.has(JSONMapping.CURRENCY)) this.setCurrency(jsonObject.getString(JSONMapping.CURRENCY));
		if (jsonObject.has(JSONMapping.NEWLY_CREATED)) this.setNewlyCreated(jsonObject.getBoolean(JSONMapping.NEWLY_CREATED));

		if (jsonObject.has(JSONMapping.CREATED)) {
			this.setCreated(this.dateFrom(jsonObject, JSONMapping.CREATED));
		}
		if (jsonObject.has(JSONMapping.IS_ACTIVE)) this.setActive(jsonObject.getInt(JSONMapping.IS_ACTIVE) > 0);

		if (jsonObject.has(JSONMapping.LINKS)) {
			JSONObject links = jsonObject.getJSONObject(JSONMapping.LINKS);
			List<String> listList = new ArrayList<>();
			if (links.has(JSONMapping.SELF)) {
				String selfLink = links.getString(JSONMapping.SELF);
				listList.add(selfLink);
			}
			this.setLinks(listList);
		}

		if (jsonObject.has(JSONMapping.ACCOUNTS)) {
			JSONArray accounts = jsonObject.getJSONArray(JSONMapping.ACCOUNTS);
			List<Account> listList = new ArrayList<>();
			for (int index = 0; index < accounts.length(); index++) {
				listList.add(new Account(accounts.getJSONObject(index)));
			}
			this.setAccounts(listList);
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		//if (this.getId() == null) returnVal.put(JSONMapping.ID, JSONObject.NULL);
		//else returnVal.put(JSONMapping.ID, this.getId());

		if (this.getName() == null) returnVal.put(JSONMapping.NAME, JSONObject.NULL);
		else returnVal.put(JSONMapping.NAME, this.getName());

		if (this.getCurrency() == null) returnVal.put(JSONMapping.CURRENCY, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY, this.getCurrency());

		returnVal.put(JSONMapping.NEWLY_CREATED, this.isNewlyCreated());

		return returnVal;
	}
}
